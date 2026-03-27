package com.pansgroup.projectbackend.module.announcement;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    /** Sortowanie: najpierw przypięte, potem najnowsze */
    List<Announcement> findByTargetGroup_IdOrderByIsPinnedDescCreatedAtDesc(Long groupId);

    List<Announcement> findAllByOrderByIsPinnedDescCreatedAtDesc();

    List<Announcement> findByBroadcastKeyOrderByCreatedAtDesc(String broadcastKey);

    @Modifying
    @Query("UPDATE Announcement a SET a.isPinned = :isPinned WHERE a.broadcastKey = :broadcastKey")
    void updateIsPinnedByBroadcastKey(String broadcastKey, boolean isPinned);
}
