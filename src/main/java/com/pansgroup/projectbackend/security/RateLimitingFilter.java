package com.pansgroup.projectbackend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Global Rate Limiting Filter – Warstwa Trójpoziomowej Ochrony Sieciowej.
 *
 * Poziomy ochrony:
 * 1. AUTH (IP)        – Endpointy logowania/rejestracji: max 5/minutę per IP (Brute-Force)
 * 2. SPAM (IP + USER) – Mutacje danych (POST/PUT/DELETE na forum, dysku, notatki):
 *                       max 40/minutę osobno per IP i per zalogowany użytkownik
 *                       → bot ze 100 różnych IP nadal uderzy w User-bucket!
 * 3. API (IP)         – Reszta API: max 150/minutę per IP
 *
 * Obrona przed OOM (OutOfMemoryError):
 * – Caffeine z rygorystycznym TTL i maksymalnym rozmiarem cache eliminuje wyciek pamięci
 *   spowodowany przez boty generujące miliony unikalnych adresów IP.
 *
 * Obrona przed IP Spoofingiem:
 * – IP pochodzi WYŁĄCZNIE z request.getRemoteAddr() (lub zarządzane przez Spring
 *   via server.forward-headers-strategy=framework w application.properties).
 * – Nie parsujemy samodzielnie X-Forwarded-For – zapobiega to trivialnej manipulacji nagłówkami.
 *
 * Normalizacja ścieżek:
 * – Używamy AntPathMatcher zamiast naiwnego startsWith(), aby uniknąć ataków
 *   path-traversal (np. /api//forum lub /api/../api/forum).
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    // ============================================================
    // Caffeine Caches – TTL 5 minut, maks. 10 000 wpisów per cache
    // Zapobiega wyciekowi pamięci (OOM) przy masowych adresach IP
    // ============================================================

    /** Cache per-IP dla endpointów autoryzacyjnych */
    private final Cache<String, Bucket> authIpCache = Caffeine.newBuilder()
            .expireAfterAccess(5, TimeUnit.MINUTES).maximumSize(10_000).build();

    /** Cache per-IP dla endpointów podatnych na spam */
    private final Cache<String, Bucket> spamIpCache = Caffeine.newBuilder()
            .expireAfterAccess(5, TimeUnit.MINUTES).maximumSize(10_000).build();

    /** Cache per-UserID dla zalogowanych użytkowników (hybrydowe limitowanie) */
    private final Cache<String, Bucket> spamUserCache = Caffeine.newBuilder()
            .expireAfterAccess(5, TimeUnit.MINUTES).maximumSize(10_000).build();

    /** Cache per-IP dla głównych zapytań API */
    private final Cache<String, Bucket> apiIpCache = Caffeine.newBuilder()
            .expireAfterAccess(5, TimeUnit.MINUTES).maximumSize(10_000).build();

    /** 
     * Cache dla typów ścieżek (0=API, 1=AUTH, 2=SPAM). 
     * Zapobiega powolnemu dopasowywaniu AntPathMatcher przy każdym zapytaniu.
     */
    private final Cache<String, Integer> pathTypeCache = Caffeine.newBuilder()
            .expireAfterWrite(1, TimeUnit.HOURS).maximumSize(2000).build();

    // ============================================================
    // Fabryki bucketów
    // ============================================================

    private Bucket bucket(int capacity) {
        return Bucket.builder()
                .addLimit(io.github.bucket4j.Bandwidth.builder()
                        .capacity(capacity)
                        .refillGreedy(capacity, Duration.ofMinutes(1))
                        .build())
                .build();
    }

    // ============================================================
    // Wzorce ścieżek (AntPathMatcher)
    // ============================================================

    private static final String[] AUTH_PATTERNS = {"/login", "/register", "/api/auth/**"};
    private static final String[] SPAM_PATTERNS  = {
            "/api/forum/**", "/api/drive/**", "/api/notes/**",
            "/api/feedback/**", "/api/chat/messages/**",
            "/api/users/**", "/api/groups/**", "/api/announcements/**",
            "/api/schedule/**", "/api/surveys/**", "/api/calendar/**",
            "/api/preferences/sync", "/api/preferences/sync/batch"
    };

    private boolean matchesAny(String path, String[] patterns) {
        if (path == null) return false;
        for (String pattern : patterns) {
            if (pathMatcher.match(pattern, path)) return true;
        }
        return false;
    }

    // ============================================================
    // Główna logika filtru
    // ============================================================

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String ip   = request.getRemoteAddr();
        String path = request.getRequestURI();
        String method = request.getMethod();

        // --- 0. Szybka kategoryzacja ścieżki (z cache) ---
        int pathType = pathTypeCache.get(path, p -> {
            if (matchesAny(p, AUTH_PATTERNS)) return 1;
            if (matchesAny(p, SPAM_PATTERNS)) return 2;
            if (p.startsWith("/api/")) return 0;
            return -1; // Nie dotyczy API
        });

        if (pathType == -1) {
            filterChain.doFilter(request, response);
            return;
        }

        // --- 1. Endpointy AUTH (logowanie, rejestracja) ---
        if (pathType == 1) {
            Bucket b = authIpCache.get(ip, k -> bucket(5));
            if (b == null || !b.tryConsume(1)) {
                reject(response, "Zbyt wiele prób logowania. Spróbuj ponownie za minutę. (Limit: 5/min)");
                return;
            }
        }

        // --- 2. Endpointy podatne na spam (mutacje danych) ---
        if (pathType == 2) {
            boolean isMutation = method.equalsIgnoreCase("POST") || method.equalsIgnoreCase("PUT") ||
                                 method.equalsIgnoreCase("DELETE") || method.equalsIgnoreCase("PATCH");

            if (isMutation) {
                // A) Limit per-IP
                Bucket ipBucket = spamIpCache.get(ip, k -> bucket(40));
                if (ipBucket == null || !ipBucket.tryConsume(1)) {
                    reject(response, "Wykryto nadmierne wysyłanie danych z Twojego adresu IP (Max: 40/min).");
                    return;
                }

                // B) Limit per-User
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                    String userKey = auth.getName();
                    Bucket userBucket = spamUserCache.get(userKey, k -> bucket(40));
                    if (userBucket == null || !userBucket.tryConsume(1)) {
                        reject(response, "Wykryto nadmierną aktywność na Twoim koncie. Limit tworzenia zasobów: 40/min.");
                        return;
                    }
                }
            }
            // SPAM patterns are also API calls, so they fall through to API limiting IF we don't return here.
            // But we already applied mutation limits. Let's still apply the base API limit of 150/min.
        }

        // --- 3. Ogólny limit API (dla wszystkich pathType 0, 1, 2) ---
        Bucket apiBucket = apiIpCache.get(ip, k -> bucket(150));
        if (apiBucket == null || !apiBucket.tryConsume(1)) {
            reject(response, "Przekroczono limit zapytań API (150/min). Spróbuj za chwilę.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\": \"" + message + "\"}");
    }
}
