package com.pansgroup.projectbackend.module.chat;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Represents a single chat message.
 * Content is stored AES-encrypted in the database.
 * Soft-deleted messages retain a null content with deletedAt timestamp.
 */
@Entity
@Table(name = "chat_messages", indexes = @Index(name = "idx_chat_msg_conv", columnList = "conversation_id, sent_at"))
@Getter
@Setter
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private ChatConversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    /**
     * AES/GCM-encrypted ciphertext stored as Base64 string.
     * Null when message is soft-deleted.
     */
    @Column(columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16, columnDefinition = "varchar(16) default 'SENT'")
    private MessageStatus status = MessageStatus.SENT;

    @Column(name = "sent_at", nullable = false, updatable = false)
    private LocalDateTime sentAt;

    /** Set when message was edited by the sender (within the edit window). */
    private LocalDateTime editedAt;

    /** Soft-delete: set when message was deleted by the sender. */
    private LocalDateTime deletedAt;

    /**
     * Legacy column mapping to satisfy the 'NOT NULL' constraint in production DB.
     * DO NOT USE for checks, use isDeleted() instead.
     */
    @Column(name = "is_deleted", nullable = false)
    private boolean isDeletedColumn = false;

    /** Legacy column mapping to satisfy the 'NOT NULL' constraint in production DB. */
    @Column(name = "type", nullable = false)
    private String type = "TEXT";

    @PrePersist
    protected void onCreate() {
        this.sentAt = LocalDateTime.now();
    }

    public boolean isDeleted() {
        return this.deletedAt != null || this.isDeletedColumn;
    }

    public enum MessageStatus {
        SENT, DELIVERED, READ
    }
}
