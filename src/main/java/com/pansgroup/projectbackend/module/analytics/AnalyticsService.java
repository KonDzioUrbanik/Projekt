package com.pansgroup.projectbackend.module.analytics;

import com.pansgroup.projectbackend.module.analytics.dto.AnalyticsEventDto;
import com.pansgroup.projectbackend.module.analytics.dto.AnalyticsSummaryDto;
import com.pansgroup.projectbackend.module.analytics.dto.PageStatDto;
import com.pansgroup.projectbackend.module.analytics.dto.ClickStatDto;
import com.pansgroup.projectbackend.module.analytics.dto.DailyStatDto;
import com.pansgroup.projectbackend.module.analytics.dto.UserActivityDto;
import com.pansgroup.projectbackend.module.analytics.dto.DeviceStatDto;
import com.pansgroup.projectbackend.module.analytics.dto.ActiveUserDto;
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
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;

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
                // Pozwalamy na zapis zdarzeń anonimowych (np. wejście na stronę logowania), 
                // ale reszta logicznych kontroli (rate limiting, admin bypass) pozostaje aktywna.
                if (auth != null && !auth.isAuthenticated()) {
                    // Ciche logowanie dla deweloperów, ale nie blokujemy
                }

                // Backend Anti-Spam: max 1 event per 100ms na sessionId
                if (dto.sessionId() == null || dto.sessionId().isBlank()) {
                        log.warn("Zdarzenie odrzucone (brak SESSION_ID)");
                        return;
                }

                // Backend Anti-Spam: Omijamy limit dla ważnych raportów czasu, dla reszty 50ms
                if (rateLimiter.size() > 10000)
                        rateLimiter.clear(); // safe clear
                long now = System.currentTimeMillis();
                Long lastEventTime = rateLimiter.get(dto.sessionId());
                
                boolean isHighPriority = "time_on_page".equals(dto.eventName());
                if (!isHighPriority && lastEventTime != null && (now - lastEventTime) < 50) {
                        log.warn("Zdarzenie odrzucone (Spam z tej samej sesji): {}", dto.sessionId());
                        return;
                }
                rateLimiter.put(dto.sessionId(), now);

                log.info("Zdarzenie odebrane: sessionId={}, eventType={}, page={}", dto.sessionId(), dto.eventType(),
                                dto.page());

                // Odrzuć administratorów (chyba że to błąd techniczny)
                boolean isAdmin = auth != null && auth.getAuthorities().stream()
                                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
                if (isAdmin && !"ERROR".equals(dto.eventType().name())) {
                        log.info("Zdarzenie odrzucone (ADMIN)");
                        return;
                }

                if (dto.page() == null || dto.page().isBlank()) {
                        log.warn("Zdarzenie odrzucone (brak PAGE)");
                        return;
                }

                String email = (auth != null && !"anonymousUser".equals(auth.getPrincipal())) ? auth.getName() : null;
                Long userId = null;
                if (email != null) {
                        userId = userRepository.findByEmail(email)
                                        .map(u -> u.getId())
                                        .orElse(null);
                }
                
                // Jeśli userId jest null (anonim), zapisujemy z userId = null.
                // Baza danych na to pozwala (nullable = true w AnalyticsEvent).

                AnalyticsEvent event = new AnalyticsEvent();
                event.setUserId(userId);
                event.setSessionId(dto.sessionId());
                event.setEventType(dto.eventType());
                event.setEventName(dto.eventName());
                event.setPage(sanitizePage(dto.page()));
                event.setDurationMs(dto.durationMs());

                log.info("Zapisywanie zdarzenia: {} {} na stronie {}", event.getEventType(), event.getEventName(),
                                event.getPage());
                AnalyticsEvent saved = repository.save(event);
                log.info("Zdarzenie zapisane pomyślnie. ID={}", saved.getId());
        }

        /**
         * Zwraca zagregowane statystyki dla panelu admina.
         */
        @Cacheable(value = "analyticsSummary", key = "'global'")
        public AnalyticsSummaryDto getSummary() {
                LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

                List<PageStatDto> topPages = repository.findTopPages(thirtyDaysAgo, TOP_20).stream()
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

                List<DeviceStatDto> deviceStats = repository.findDeviceStats(TOP_20).stream()
                                .map(row -> new DeviceStatDto(
                                                (String) row[0],
                                                ((Number) row[1]).longValue()))
                                .collect(Collectors.toList());

                List<ClickStatDto> recentErrors = repository.findRecentErrors(TOP_50).stream()
                                .map(row -> new ClickStatDto(
                                                (String) row[0],
                                                ((Number) row[1]).longValue()))
                                .collect(Collectors.toList());

                List<ClickStatDto> scrollStats = repository.findScrollDepthStats().stream()
                                .map(row -> new ClickStatDto(
                                                (String) row[0],
                                                ((Number) row[1]).longValue()))
                                .sorted((a, b) -> {
                                        try {
                                                int valA = Integer.parseInt(a.eventName().replaceAll("\\D+", ""));
                                                int valB = Integer.parseInt(b.eventName().replaceAll("\\D+", ""));
                                                return Integer.compare(valA, valB);
                                        } catch (Exception e) {
                                                return a.eventName().compareTo(b.eventName());
                                        }
                                })
                                .collect(Collectors.toList());

                // Nowe statystyki: Średni czas sesji i aktywni online
                String avgDuration = calculateAvgSessionDuration(thirtyDaysAgo);
                List<ActiveUserDto> activeUsers = buildActiveUsers();

                return new AnalyticsSummaryDto(
                                totalPageViews, totalSessions, totalClicksCount,
                                avgDuration, (long) activeUsers.size(), activeUsers,
                                topPages, topClicks, daily, users,
                                deviceStats, recentErrors, scrollStats);
        }

        private String calculateAvgSessionDuration(LocalDateTime since) {
                List<Object[]> durations = repository.findSessionDurations(since);
                if (durations.isEmpty())
                        return "0s";

                long totalSeconds = 0;
                int count = 0;
                long maxSessionDuration = 2 * 60 * 60; // 2 godziny limitu
                long minSessionDuration = 10; // Ignorujemy sesje krótsze niż 10s (błędy/odbicia)

                for (Object[] row : durations) {
                        LocalDateTime start = (LocalDateTime) row[1];
                        LocalDateTime end = (LocalDateTime) row[2];
                        if (start != null && end != null) {
                                long diff = java.time.Duration.between(start, end).toSeconds();
                                
                                // Ignorujemy zbyt krótkie sesje (noise)
                                if (diff < minSessionDuration) {
                                        continue;
                                }

                                // Cap session at max duration
                                if (diff > maxSessionDuration) {
                                        diff = maxSessionDuration;
                                }
                                
                                totalSeconds += diff;
                                count++;
                        }
                }

                if (count == 0)
                        return "0s";
                long avgSeconds = totalSeconds / count;

                long minutes = avgSeconds / 60;
                long seconds = avgSeconds % 60;

                return minutes > 0 ? minutes + "m " + seconds + "s" : seconds + "s";
        }

        private List<ActiveUserDto> buildActiveUsers() {
                LocalDateTime fiveMinutesAgo = LocalDateTime.now().minusMinutes(5);
                List<Object[]> activeRows = repository.findActiveUsersDetails(fiveMinutesAgo);

                if (activeRows.isEmpty())
                        return List.of();

                // Optymalizacja N+1: Pobieramy dane użytkowników jednym zapytaniem
                List<Long> userIds = activeRows.stream()
                                .map(row -> ((Number) row[0]).longValue())
                                .distinct()
                                .collect(Collectors.toList());

                Map<Long, com.pansgroup.projectbackend.module.user.User> userMap = userRepository.findAllById(userIds)
                                .stream()
                                .collect(Collectors.toMap(com.pansgroup.projectbackend.module.user.User::getId,
                                                u -> u));

                return activeRows.stream()
                                .map(row -> {
                                        Long uid = ((Number) row[0]).longValue();
                                        LocalDateTime lastAct = (LocalDateTime) row[1];
                                        String lastPage = (String) row[2];

                                        com.pansgroup.projectbackend.module.user.User u = userMap.get(uid);
                                        String name = (u != null)
                                                        ? u.getFirstName() + " " + u.getLastName() + " ("
                                                                        + u.getRole().replace("ROLE_", "") + ")"
                                                        : "Anonim #" + uid;

                                        return new ActiveUserDto(uid, name, lastPage, lastAct);
                                })
                                .collect(Collectors.toList());
        }

        private List<UserActivityDto> buildUserActivity() {
                List<Object[]> summary = repository.findUserActivitySummary(TOP_50);
                if (summary.isEmpty())
                        return List.of();

                // Optymalizacja N+1: Pobieramy dane użytkowników jednym zapytaniem
                List<Long> userIds = summary.stream()
                                .map(row -> ((Number) row[0]).longValue())
                                .distinct()
                                .collect(Collectors.toList());

                Map<Long, com.pansgroup.projectbackend.module.user.User> userMap = userRepository.findAllById(userIds)
                                .stream()
                                .collect(Collectors.toMap(com.pansgroup.projectbackend.module.user.User::getId, u -> u));

                return summary.stream()
                                .map(row -> {
                                        Long uid = ((Number) row[0]).longValue();
                                        long sessions = ((Number) row[1]).longValue();
                                        long events = ((Number) row[2]).longValue();

                                        com.pansgroup.projectbackend.module.user.User u = userMap.get(uid);
                                        // Zabezpieczenie RODO/GDPR - pseudonimizacja w widoku panelu.
                                        String name = (u != null)
                                                        ? (u.getRole() != null ? u.getRole().replace("ROLE_", "")
                                                                        : "UŻYTKOWNIK") + " #" + u.getId() + " ("
                                                                        + u.getFirstName().charAt(0) + "***)"
                                                        : "Konto usunięte";

                                        return new UserActivityDto(uid, name, sessions, events);
                                })
                                .collect(Collectors.toList());
        }

        /**
         * Usuwa wszystkie wystąpienia konkretnego błędu.
         */
        @Transactional
        @CacheEvict(value = "analyticsSummary", allEntries = true)
        public void deleteError(String eventName) {
                repository.deleteByEventTypeAndEventName(AnalyticsEvent.EventType.ERROR, eventName);
        }

        /**
         * Usuwa wszystkie błędy techniczne z bazy.
         */
        @Transactional
        @CacheEvict(value = "analyticsSummary", allEntries = true)
        public void deleteAllErrors() {
                repository.deleteByEventType(AnalyticsEvent.EventType.ERROR);
        }

        /**
         * Usuwa zbędne parametry query i fragmenty z URLa dla bezpieczeństwa i
         * spójności.
         */
        private String sanitizePage(String page) {
                if (page == null)
                        return "/";
                // Zachowujemy parametry query (?userId=...), ale usuwamy fragmenty (#...)
                int h = page.indexOf('#');
                if (h >= 0)
                        page = page.substring(0, h);
                return page.length() <= 255 ? page : page.substring(0, 255);
        }

        /**
         * Ręczne odświeżenie (wyczyszczenie) cache analityki.
         */
        @Transactional
        @CacheEvict(value = "analyticsSummary", allEntries = true)
        public void refreshCache() {
                log.info("Ręczne odświeżanie cache analityki...");
        }
}
