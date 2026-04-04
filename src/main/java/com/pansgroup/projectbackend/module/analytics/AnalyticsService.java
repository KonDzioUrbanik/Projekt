package com.pansgroup.projectbackend.module.analytics;

import com.pansgroup.projectbackend.module.analytics.dto.AnalyticsEventDto;
import com.pansgroup.projectbackend.module.analytics.dto.AnalyticsSummaryDto;
import com.pansgroup.projectbackend.module.analytics.dto.PageStatDto;
import com.pansgroup.projectbackend.module.analytics.dto.ClickStatDto;
import com.pansgroup.projectbackend.module.analytics.dto.DailyStatDto;
import com.pansgroup.projectbackend.module.analytics.dto.UserActivityDto;
import com.pansgroup.projectbackend.module.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsService {

        private final AnalyticsEventRepository repository;
        private final UserRepository userRepository;

        private final Map<String, Long> rateLimiter = new ConcurrentHashMap<>();

        private static final Pageable TOP_20 = PageRequest.of(0, 20);
        private static final Pageable TOP_50 = PageRequest.of(0, 50);

        /**
         * Zapisuje zdarzenie analityczne. Odrzuca zdarzenia od ADMIN.
         */
        @Transactional
        public void saveEvent(AnalyticsEventDto dto, Authentication auth) {
                if (auth == null || !auth.isAuthenticated())
                        return;

                // Backend Anti-Spam: max 1 event per 100ms na sessionId
                if (rateLimiter.size() > 10000) rateLimiter.clear(); // safe clear
                long now = System.currentTimeMillis();
                Long lastEventTime = rateLimiter.get(dto.sessionId());
                if (lastEventTime != null && (now - lastEventTime) < 100) {
                        log.warn("Zdarzenie odrzucone (Spam z tej samej sesji): {}", dto.sessionId());
                        return;
                }
                rateLimiter.put(dto.sessionId(), now);

                log.info("Zdarzenie odebrane: sessionId={}, eventType={}, page={}", dto.sessionId(), dto.eventType(), dto.page());

                // Odrzuć administratorów
                boolean isAdmin = auth.getAuthorities().stream()
                                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
                if (isAdmin) {
                        log.info("Zdarzenie odrzucone (ADMIN)");
                        return;
                }

                // Odrzuć puste/nieprawidłowe dane
                if (dto.page() == null || dto.page().isBlank()) {
                        log.warn("Zdarzenie odrzucone (brak PAGE)");
                        return;
                }
                if (dto.sessionId() == null || dto.sessionId().isBlank()) {
                        log.warn("Zdarzenie odrzucone (brak SESSION_ID)");
                        return;
                }

                String email = auth.getName();
                Long userId = userRepository.findByEmail(email)
                                .map(u -> u.getId())
                                .orElse(null);
                if (userId == null)
                        return;

                AnalyticsEvent event = new AnalyticsEvent();
                event.setUserId(userId);
                event.setSessionId(dto.sessionId());
                event.setEventType(dto.eventType());
                event.setEventName(dto.eventName());
                event.setPage(sanitizePage(dto.page()));
                event.setDurationMs(dto.durationMs());

                repository.save(event);
        }

        /**
         * Zwraca zagregowane statystyki dla panelu admina.
         */
        public AnalyticsSummaryDto getSummary() {
                LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

                List<PageStatDto> topPages = repository.findTopPages(TOP_20).stream()
                                .map(row -> new PageStatDto(
                                                (String) row[0],
                                                ((Number) row[1]).longValue(),
                                                row[2] != null ? ((Number) row[2]).longValue() : null))
                                .collect(Collectors.toList());

                List<ClickStatDto> topClicks = repository.findTopClicks(TOP_20).stream()
                                .map(row -> new ClickStatDto(
                                                (String) row[0],
                                                ((Number) row[1]).longValue()))
                                .collect(Collectors.toList());

                // Agregacja dzienna po stronie Java — bezpieczna, bez niestandardowego JPQL
                List<DailyStatDto> daily = repository.findSince(thirtyDaysAgo).stream()
                                .collect(Collectors.groupingBy(
                                                e -> e.getCreatedAt().toLocalDate().toString(),
                                                Collectors.counting()))
                                .entrySet().stream()
                                .sorted(Map.Entry.comparingByKey())
                                .map(entry -> new DailyStatDto(entry.getKey(), entry.getValue()))
                                .collect(Collectors.toList());

                List<UserActivityDto> users = buildUserActivity();

                long totalPageViews = repository.countPageViewsSince(thirtyDaysAgo);
                long totalSessions = repository.countUniqueSessionsSince(thirtyDaysAgo);
                long totalClicksCount = repository.countClicksSince(thirtyDaysAgo);

                return new AnalyticsSummaryDto(
                                totalPageViews, totalSessions, totalClicksCount, topPages, topClicks, daily, users);
        }

        private List<UserActivityDto> buildUserActivity() {
                return repository.findUserActivitySummary(TOP_50).stream()
                                .map(row -> {
                                        Long uid = ((Number) row[0]).longValue();
                                        long sessions = ((Number) row[1]).longValue();
                                        long events = ((Number) row[2]).longValue();
                                        // Zabezpieczenie RODO/GDPR - pseudonimizacja w widoku panelu.
                                        String name = userRepository.findById(uid)
                                                        .map(u -> {
                                                                String rola = u.getRole() != null ? u.getRole().replace("ROLE_", "") : "UŻYTKOWNIK";
                                                                return rola + " #" + u.getId() + " (" + u.getFirstName().charAt(0) + "***)";
                                                        })
                                                        .orElse("Konto usunięte");
                                        return new UserActivityDto(uid, name, sessions, events);
                                })
                                .collect(Collectors.toList());
        }

        /**
         * Usuwa zbędne parametry query i fragmenty z URLa dla bezpieczeństwa i
         * spójności.
         */
        private String sanitizePage(String page) {
                if (page == null)
                        return "/";
                int q = page.indexOf('?');
                if (q >= 0)
                        page = page.substring(0, q);
                int h = page.indexOf('#');
                if (h >= 0)
                        page = page.substring(0, h);
                return page.length() <= 255 ? page : page.substring(0, 255);
        }
}
