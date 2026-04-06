package com.pansgroup.projectbackend.module.forum;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ForumThreadLikeRepository extends JpaRepository<ForumThreadLike, Long> {
    long countByThread_Id(Long threadId);

    boolean existsByThread_IdAndUser_Id(Long threadId, Long userId);

    Optional<ForumThreadLike> findByThread_IdAndUser_Id(Long threadId, Long userId);
}

