package com.pansgroup.projectbackend.module.forum;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ForumCommentVoteRepository extends JpaRepository<ForumCommentVote, Long> {
    Optional<ForumCommentVote> findByComment_IdAndUser_Id(Long commentId, Long userId);

    void deleteByComment_IdAndUser_Id(Long commentId, Long userId);

    void deleteByComment_Id(Long commentId);

    @Query("SELECT COALESCE(SUM(CASE WHEN v.voteType = 'UPVOTE' THEN 1 ELSE -1 END), 0) FROM ForumCommentVote v WHERE v.comment.id = ?1")
    Long getVoteScore(Long commentId);
}

