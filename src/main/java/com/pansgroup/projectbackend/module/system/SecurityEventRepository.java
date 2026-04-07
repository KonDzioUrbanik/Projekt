package com.pansgroup.projectbackend.module.system;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SecurityEventRepository extends JpaRepository<SecurityEvent, Long> {

    @Query("SELECT e.ipAddress FROM SecurityEvent e " +
           "WHERE e.eventType = 'FAILED_LOGIN' " +
           "AND e.timestamp > :after " +
           "GROUP BY e.ipAddress " +
           "HAVING COUNT(e) > :threshold")
    List<String> findSuspiciousIPs(@Param("after") LocalDateTime after, @Param("threshold") Long threshold);

    @Modifying
    @Query("DELETE FROM SecurityEvent e WHERE e.timestamp < :expiryDate")
    void deleteOlderThan(@Param("expiryDate") LocalDateTime expiryDate);
}
