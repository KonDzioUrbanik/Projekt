package com.pansgroup.projectbackend.module.forum;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForumCommentAttachmentRepository extends JpaRepository<ForumCommentAttachment, Long> {
    List<ForumCommentAttachment> findByComment_Id(Long commentId);

    void deleteByComment_Id(Long commentId);
}

