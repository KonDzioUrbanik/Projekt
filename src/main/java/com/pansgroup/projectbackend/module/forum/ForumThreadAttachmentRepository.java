package com.pansgroup.projectbackend.module.forum;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForumThreadAttachmentRepository extends JpaRepository<ForumThreadAttachment, Long> {
    List<ForumThreadAttachment> findByThread_Id(Long threadId);
}

