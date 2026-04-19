package com.pansgroup.projectbackend.module.forum;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ForumThreadVoteRepository extends JpaRepository<ForumThreadVote, Long> {
    Optional<ForumThreadVote> findByThread_IdAndUser_Id(Long threadId, Long userId);

    void deleteByThread_IdAndUser_Id(Long threadId, Long userId);

    @Query("SELECT COALESCE(SUM(CASE WHEN v.voteType = 'UPVOTE' THEN 1 ELSE -1 END), 0) FROM ForumThreadVote v WHERE v.thread.id = ?1")
    Long getVoteScore(Long threadId);
}

