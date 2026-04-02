package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.system.SystemService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import org.springframework.lang.NonNull;
import java.io.IOException;

/* Filtr HTTP egzekwujący tryb konserwacji systemu */
@RequiredArgsConstructor
public class SystemMaintenanceFilter extends OncePerRequestFilter {

    private final SystemService systemService;

    /* Token bypass ustawiany przez SecurityConfig */
    private String bypassToken = "";

    /*
     * Wywoływany przez SecurityConfig#systemMaintenanceFilter() przy tworzeniu
     * filtra.
     */
    public void setBypassToken(String bypassToken) {
        this.bypassToken = bypassToken != null ? bypassToken : "";
    }

    private static final String SESSION_BYPASS_KEY = "maintenance_bypass_granted";

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Zasoby statyczne - zawsze dostępne, bez żadnych sprawdzeń
        if (isStaticResource(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Globalna przerwa techniczna
        boolean globalMaintenance = "true".equalsIgnoreCase(
                systemService.getSetting("global_maintenance", "false"));

        if (globalMaintenance) {
            // Sprawdź bypass token z parametru URL (?bypass=TOKEN)
            String paramToken = request.getParameter("bypass");
            if (StringUtils.hasText(bypassToken) && isValidBypassAttempt(paramToken)) {
                // Timing-safe comparison — zapobiega timing attacks przy porównywaniu tokenów
                if (timingSafeEquals(bypassToken, paramToken)) {
                    if (isAuthenticatedNonAdmin()) {
                        HttpSession oldSession = request.getSession(false);
                        if (oldSession != null) {
                            oldSession.invalidate();
                        }
                        SecurityContextHolder.clearContext();

                        jakarta.servlet.http.Cookie rememberMeCookie = new jakarta.servlet.http.Cookie("remember-me",
                                null);
                        rememberMeCookie.setMaxAge(0);
                        rememberMeCookie.setPath("/");
                        response.addCookie(rememberMeCookie);
                    }
                    HttpSession session = request.getSession(true);
                    session.setAttribute(SESSION_BYPASS_KEY, true);
                    response.sendRedirect("/login");
                    return;
                }
            }

            // Sprawdź czy bypass aktywny w sesji
            HttpSession session = request.getSession(false);
            boolean bypassGranted = session != null &&
                    Boolean.TRUE.equals(session.getAttribute(SESSION_BYPASS_KEY));

            if (bypassGranted) {
                // Bypass aktywny ale dostęp tylko dla administratorów
                if (isAuthenticatedNonAdmin()) {
                    if (session != null)
                        session.removeAttribute(SESSION_BYPASS_KEY);
                    if (isApiPath(path)) {
                        sendJsonMaintenanceResponse(response, "System");
                    } else {
                        response.sendRedirect("/maintenance");
                    }
                    return;
                }
                // Admin z bypassem — przepuść
                filterChain.doFilter(request, response);
                return;
            }

            // Bypass nieaktywny — przepuść tylko /maintenance i wybrane ścieżki systemowe
            if (path.equals("/maintenance") || path.startsWith("/module-maintenance")
                    || path.startsWith("/api/system/module-status/")
                    || path.startsWith("/api/system/maintenance-bypass")
                    || path.startsWith("/error/")) {
                filterChain.doFilter(request, response);
                return;
            }
            // Wszystko inne — blokuj
            if (isApiPath(path)) {
                sendJsonMaintenanceResponse(response, "System");
            } else {
                response.sendRedirect("/maintenance");
            }
            return;

        } else if (path.equals("/maintenance")) {
            // Tryb wyłączony, ktoś wszedł na /maintenance bezpośrednio — powrót na home
            response.sendRedirect("/home");
            return;
        }

        // 3. Blokada selektywna modułów — tylko dla niezalogowanych lub nie-adminów
        if (!isAdmin()) {
            if (checkModuleBlock(request, response, path, "/student/notes", "module_notes", "Notatki"))
                return;
            if (checkModuleBlock(request, response, path, "/student/schedule", "module_schedule", "Harmonogram zajęć"))
                return;
            if (checkAnnouncementsBlock(request, response, path))
                return;
            if (checkModuleBlock(request, response, path, "/student/calendar", "module_calendar", "Kalendarz"))
                return;
            if (checkModuleBlock(request, response, path, "/student/attendance", "module_attendance", "Obecności"))
                return;
            if (checkModuleBlock(request, response, path, "/student/forum", "module_forum", "Forum"))
                return;
            if (checkModuleBlock(request, response, path, "/student/university-calendar", "module_university_calendar",
                    "Kalendarz akademicki"))
                return;
            if (checkModuleBlock(request, response, path, "/student/academic-progress", "module_semester_progress",
                    "Postęp semestru"))
                return;
            if (checkModuleBlock(request, response, path, "/starosta/announcements", "module_starosta_announcements",
                    "Ogłoszenia starosty"))
                return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Sprawdza blokadę modułu i odsyła odpowiedź jeśli moduł wyłączony. Zwraca true
     * = żądanie obsłużone.
     */
    private boolean checkModuleBlock(HttpServletRequest request, HttpServletResponse response,
            String path, String prefix, String settingKey, String moduleName) throws IOException {
        if (path.startsWith(prefix) && !systemService.isModuleEnabled(settingKey)) {
            redirectOrJson(request, response, moduleName);
            return true;
        }
        return false;
    }

    /**
     * Specjalna obsługa ogłoszeń — blokuje zarówno widok /student/announcements jak
     * i API /api/announcements.
     */
    private boolean checkAnnouncementsBlock(HttpServletRequest request, HttpServletResponse response,
            String path) throws IOException {
        boolean isAnnouncementPath = path.startsWith("/student/announcements")
                || (path.startsWith("/api/announcements") && !path.startsWith("/api/announcements/dashboard-feed"));
        if (isAnnouncementPath && !systemService.isModuleEnabled("module_announcements")) {
            redirectOrJson(request, response, "Ogłoszenia grupy");
            return true;
        }
        return false;
    }

    /** Wysyła redirect HTML lub JSON 503 w zależności od typu żądania. */
    private void redirectOrJson(HttpServletRequest request, HttpServletResponse response, String moduleName)
            throws IOException {
        if (isApiPath(request.getRequestURI())) {
            sendJsonMaintenanceResponse(response, moduleName);
        } else {
            response.sendRedirect("/module-maintenance?module=" +
                    java.net.URLEncoder.encode(moduleName, "UTF-8"));
        }
    }

    /** Zwraca true jeśli ścieżka jest endpointem API (zaczyna się od /api/). */
    private boolean isApiPath(String path) {
        return path.startsWith("/api/");
    }

    /** Zasoby statyczne — zawsze przepuszczane, bez żadnych blokad. */
    private boolean isStaticResource(String path) {
        return path.startsWith("/static/") ||
                path.startsWith("/css/") ||
                path.startsWith("/js/") ||
                path.startsWith("/images/") ||
                path.startsWith("/favicon");
    }

    /**
     * Wstępna walidacja tokenu przesłanego przez URL przed porównaniem z wzorcem.
     * Odrzuca tokeny puste, za długie lub zawierające niedozwolone znaki.
     * Spójne z walidacją po stronie JS w maintenance.html.
     */
    private boolean isValidBypassAttempt(String token) {
        if (!StringUtils.hasText(token))
            return false;
        if (token.length() > 128)
            return false;
        // Dopuszczamy wyłącznie znaki alfanumeryczne, myślniki i podkreślenia
        return token.matches("[a-zA-Z0-9\\-_]+");
    }

    /**
     * Porównanie tokenów odporne na timing attack (constant-time comparison).
     * Zwykłe String.equals() kończy przetwarzanie przy pierwszym różniącym się
     * znaku,
     * co pozwala na ustalenie prefiksu tokenu przez pomiar czasu odpowiedzi.
     * MessageDigest.isEqual() zawsze porównuje całe tablice bajtów w stałym czasie.
     */
    private boolean timingSafeEquals(String expected, String actual) {
        byte[] expectedBytes = expected.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] actualBytes = actual.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return java.security.MessageDigest.isEqual(expectedBytes, actualBytes);
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    /**
     * Zwraca true gdy użytkownik jest faktycznie zalogowany (nie anonimowy)
     * i NIE posiada roli ROLE_ADMIN. Używane do weryfikacji po zalogowaniu
     * z aktywnym bypassem — tylko admin ma prawo do dostępu podczas konserwacji.
     */
    private boolean isAuthenticatedNonAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated())
            return false;
        if (auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)
            return false;
        return auth.getAuthorities().stream()
                .noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private void sendJsonMaintenanceResponse(HttpServletResponse response, String moduleName) throws IOException {
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        String safeModule = moduleName.replace("\"", "\\\"");
        response.getWriter().write("{\"error\":\"maintenance\",\"module\":\"" + safeModule + "\"}");
    }
}
