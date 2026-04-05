package com.pansgroup.projectbackend.module.chat;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Represents a private conversation between exactly two users.
 * The pair (userA, userB) is unique — the lower ID is always stored as userA.
 */
@Entity
@Table(name = "chat_conversations", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "user_a_id", "user_b_id" })
})
@Getter
@Setter
public class ChatConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_a_id", nullable = false)
    private User userA;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_b_id", nullable = false)
    private User userB;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Updated on every new message for sidebar ordering. */
    private LocalDateTime lastMessageAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.lastMessageAt = LocalDateTime.now();
    }
}
