package com.pansgroup.projectbackend.module.forum;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ForumCommentRepository extends JpaRepository<ForumComment, Long> {
    List<ForumComment> findByAuthor_IdOrderByCreatedAtDesc(Long authorId);

    Optional<ForumComment> findByIdAndThread_Id(Long commentId, Long threadId);

    @Modifying
    @Query("DELETE FROM ForumComment c WHERE c.id = :commentId AND c.thread.id = :threadId")
    int deleteByIdAndThreadId(@Param("commentId") Long commentId, @Param("threadId") Long threadId);

    long countByAuthor_Id(Long authorId);
}

