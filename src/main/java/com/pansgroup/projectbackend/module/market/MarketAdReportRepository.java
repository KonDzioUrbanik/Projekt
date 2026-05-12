package com.pansgroup.projectbackend.module.market;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MarketAdReportRepository extends JpaRepository<MarketAdReport, Long> {
    List<MarketAdReport> findByResolvedFalseOrderByCreatedAtDesc();
    List<MarketAdReport> findByAdId(Long adId);
    long countByAdIdAndResolvedFalse(Long adId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MarketAdReport r WHERE r.ad.id = :adId")
    void deleteAllByAdId(@Param("adId") Long adId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MarketAdReport r WHERE r.reporter.id = :userId")
    void deleteAllByReporterId(@Param("userId") Long userId);

    boolean existsByAdIdAndReporterId(Long adId, Long reporterId);

    long countByReporterIdAndCreatedAtAfter(Long reporterId, java.time.LocalDateTime date);
}
