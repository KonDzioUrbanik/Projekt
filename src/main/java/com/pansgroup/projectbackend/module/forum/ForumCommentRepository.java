package com.pansgroup.projectbackend.module.forum;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ForumCommentRepository extends JpaRepository<ForumComment, Long> {
    List<ForumComment> findByAuthor_IdOrderByCreatedAtDesc(Long authorId);
    long countByAuthor_Id(Long authorId);
}

