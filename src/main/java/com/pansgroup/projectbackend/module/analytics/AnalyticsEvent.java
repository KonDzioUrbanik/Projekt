package com.pansgroup.projectbackend.module.analytics;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "analytics_events", indexes = {
        @Index(name = "idx_ae_user", columnList = "user_id"),
        @Index(name = "idx_ae_page", columnList = "page"),
        @Index(name = "idx_ae_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
public class AnalyticsEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = true)
    private Long userId;

    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 32)
    private EventType eventType;

    @Column(name = "event_name", length = 255)
    private String eventName;

    @Column(name = "page", nullable = false, length = 255)
    private String page;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public enum EventType {
        PAGE_VIEW, CLICK, FORM_SUBMIT, SCROLL_DEPTH, ERROR, DEVICE_INFO
    }
}
