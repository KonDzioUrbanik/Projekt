package com.pansgroup.projectbackend.module.system;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "security_events")
@Getter
@Setter
public class SecurityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private String eventType; // e.g., FAILED_LOGIN, BRUTE_FORCE_DETECTED, PASSWORD_CHANGE, EMAIL_CHANGE

    @Column(length = 100)
    private String ipAddress;

    @Column(length = 500)
    private String details;

    @Column
    private Long userId;

    private String email; // Useful for failed logins where userId might be null

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
}
