package com.pansgroup.projectbackend.module.analytics;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, Long> {

       // --- Top strony wg liczby odwiedzin ---
       @Query("SELECT e.page, COUNT(e), " +
                     "AVG(CASE WHEN e.eventName = 'time_on_page' THEN e.durationMs ELSE NULL END) " +
                     "FROM AnalyticsEvent e " +
                     "WHERE e.eventType = 'PAGE_VIEW' AND e.createdAt >= :since " +
                     "GROUP BY e.page ORDER BY COUNT(e) DESC")
       List<Object[]> findTopPages(@Param("since") LocalDateTime since, Pageable pageable);

       // --- Top klikane elementy (wykluczając błędy) ---
       @Query("SELECT e.eventName, COUNT(e) " +
                     "FROM AnalyticsEvent e WHERE e.eventType = 'CLICK' AND e.eventName IS NOT NULL " +
                     "GROUP BY e.eventName ORDER BY COUNT(e) DESC")
       List<Object[]> findTopClicks(Pageable pageable);

       // --- Statystyki urządzeń ---
       @Query("SELECT e.eventName, COUNT(e) " +
                     "FROM AnalyticsEvent e WHERE e.eventType = 'DEVICE_INFO' " +
                     "GROUP BY e.eventName ORDER BY COUNT(e) DESC")
       List<Object[]> findDeviceStats(Pageable pageable);

       // --- Logi błędów ---
       @Query("SELECT e.eventName, COUNT(e) " +
                     "FROM AnalyticsEvent e WHERE e.eventType = 'ERROR' " +
                     "GROUP BY e.eventName ORDER BY COUNT(e) DESC")
       List<Object[]> findRecentErrors(Pageable pageable);

       // --- Statystyki przewijania ---
       @Query("SELECT e.eventName, COUNT(e) " +
                     "FROM AnalyticsEvent e WHERE e.eventType = 'SCROLL_DEPTH' " +
                     "GROUP BY e.eventName")
       List<Object[]> findScrollDepthStats();

       // --- Zdarzenia z ostatnich N dni (do agregacji dziennej po stronie serwisu) ---
       @Query("SELECT e FROM AnalyticsEvent e WHERE e.createdAt >= :since ORDER BY e.createdAt")
       List<AnalyticsEvent> findSince(@Param("since") LocalDateTime since);

       // --- Statystyki per użytkownik ---
       @Query("SELECT e.userId, COUNT(DISTINCT e.sessionId), COUNT(e) " +
                     "FROM AnalyticsEvent e GROUP BY e.userId ORDER BY COUNT(e) DESC")
       List<Object[]> findUserActivitySummary(Pageable pageable);

       // --- Łączna liczba unikalnych sesji (30 dni) ---
       @Query("SELECT COUNT(DISTINCT e.sessionId) FROM AnalyticsEvent e WHERE e.createdAt >= :since")
       long countUniqueSessionsSince(@Param("since") LocalDateTime since);

       // --- Łączna liczba odwiedzin stron (30 dni) ---
       @Query("SELECT COUNT(e) FROM AnalyticsEvent e WHERE e.eventType = 'PAGE_VIEW' AND e.createdAt >= :since")
       long countPageViewsSince(@Param("since") LocalDateTime since);

       // --- Łączna liczba kliknięć (30 dni) ---
       @Query("SELECT COUNT(e) FROM AnalyticsEvent e WHERE e.eventType = 'CLICK' AND e.createdAt >= :since")
       long countClicksSince(@Param("since") LocalDateTime since);

       // --- Usuwanie błędów o konkretnej nazwie ---
       @org.springframework.transaction.annotation.Transactional
       void deleteByEventTypeAndEventName(AnalyticsEvent.EventType eventType, String eventName);

       // --- Usuwanie wszystkich błędów ---
       @org.springframework.transaction.annotation.Transactional
       void deleteByEventType(AnalyticsEvent.EventType eventType);

       // --- Statystyki sesji (do średniego czasu) ---
       @Query("SELECT e.sessionId, MIN(e.createdAt), MAX(e.createdAt) " +
                     "FROM AnalyticsEvent e WHERE e.createdAt >= :since " +
                     "GROUP BY e.sessionId, CAST(e.createdAt AS date)")
       List<Object[]> findSessionDurations(@Param("since") LocalDateTime since);

       // --- Dane aktywnych użytkowników (ostatnie 5 min) ---
       @Query("SELECT e.userId, e.createdAt, e.page " +
                     "FROM AnalyticsEvent e " +
                     "WHERE e.id IN (" +
                     "  SELECT MAX(e2.id) FROM AnalyticsEvent e2 " +
                     "  WHERE e2.createdAt >= :since AND e2.userId IS NOT NULL " +
                     "  GROUP BY e2.userId" +
                     ") ORDER BY e.createdAt DESC")
       List<Object[]> findActiveUsersDetails(@Param("since") LocalDateTime since);

       @Query("SELECT e.userId, MAX(e.createdAt) " +
                     "FROM AnalyticsEvent e WHERE e.createdAt >= :since GROUP BY e.userId ORDER BY MAX(e.createdAt) DESC")
       List<Object[]> findActiveUsersLastActivity(@Param("since") LocalDateTime since);

       // --- Pobieranie ostatniej strony dla konkretnego użytkownika we wskazanym czasie ---
       @Query("SELECT e.page FROM AnalyticsEvent e WHERE e.userId = :userId AND e.createdAt = :lastActivity")
       List<String> findPageAtTime(@Param("userId") Long userId, @Param("lastActivity") LocalDateTime lastActivity);

       // --- Zdarzenia konkretnego użytkownika ---
       List<AnalyticsEvent> findByUserIdOrderByCreatedAtDesc(Long userId);

       // --- Ostatnie 100 zdarzeń konkretnego użytkownika (User Journey — fallback) ---
       List<AnalyticsEvent> findTop100ByUserIdOrderByCreatedAtDesc(Long userId);

       // --- User Journey: dynamiczny limit przez Pageable ---
       @Query("SELECT e FROM AnalyticsEvent e WHERE e.userId = :userId ORDER BY e.createdAt DESC")
       List<AnalyticsEvent> findTopNByUserIdOrderByCreatedAtDesc(
               @Param("userId") Long userId, Pageable pageable);
}
