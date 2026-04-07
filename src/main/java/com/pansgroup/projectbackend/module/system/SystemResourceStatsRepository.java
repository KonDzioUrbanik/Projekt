package com.pansgroup.projectbackend.module.system;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SystemResourceStatsRepository extends JpaRepository<SystemResourceStats, Long> {
    List<SystemResourceStats> findTop14ByOrderByTimestampDesc();

    @Modifying
    @Query("DELETE FROM SystemResourceStats s WHERE s.timestamp < :expiryDate")
    void deleteOlderThan(@Param("expiryDate") LocalDateTime expiryDate);
}
