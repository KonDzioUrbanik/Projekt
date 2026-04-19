package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "portal_forum_comment_votes", uniqueConstraints = {
        @UniqueConstraint(name = "uk_portal_forum_comment_vote", columnNames = {"comment_id", "user_id"})
})
@Getter
@Setter
public class ForumCommentVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "comment_id", nullable = false)
    private ForumComment comment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VoteType voteType; // UPVOTE, DOWNVOTE

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum VoteType {
        UPVOTE, DOWNVOTE
    }
}

