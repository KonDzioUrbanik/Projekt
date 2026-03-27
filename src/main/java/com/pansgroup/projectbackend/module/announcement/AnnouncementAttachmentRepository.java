package com.pansgroup.projectbackend.module.announcement;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnnouncementAttachmentRepository extends JpaRepository<AnnouncementAttachment, Long> {

    List<AnnouncementAttachment> findByAnnouncement_Id(Long announcementId);

    void deleteByAnnouncement_Id(Long announcementId);
}
