package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "portal_forum_thread_votes", uniqueConstraints = {
        @UniqueConstraint(name = "uk_portal_forum_thread_vote", columnNames = {"thread_id", "user_id"})
})
@Getter
@Setter
public class ForumThreadVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "thread_id", nullable = false)
    private ForumThread thread;

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

