package com.pansgroup.projectbackend.module.announcement;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findByTargetGroup_IdOrderByCreatedAtDesc(Long groupId);
}
