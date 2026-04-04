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
    @Query("SELECT e.page, COUNT(e), AVG(e.durationMs) " +
           "FROM AnalyticsEvent e WHERE e.eventType = 'PAGE_VIEW' " +
           "GROUP BY e.page ORDER BY COUNT(e) DESC")
    List<Object[]> findTopPages(Pageable pageable);

    // --- Top klikane elementy ---
    @Query("SELECT e.eventName, COUNT(e) " +
           "FROM AnalyticsEvent e WHERE e.eventType = 'CLICK' AND e.eventName IS NOT NULL " +
           "GROUP BY e.eventName ORDER BY COUNT(e) DESC")
    List<Object[]> findTopClicks(Pageable pageable);

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

    // --- Zdarzenia konkretnego użytkownika ---
    List<AnalyticsEvent> findByUserIdOrderByCreatedAtDesc(Long userId);
}
