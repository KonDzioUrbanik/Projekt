package com.pansgroup.projectbackend.module.feedback;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "feedback")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Feedback {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String type; // BUG, SUGGESTION, OTHER

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    private String email;

    @Column(length = 500)
    private String url;

    @Column(length = 500)
    private String userAgent;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private FeedbackStatus status = FeedbackStatus.OPEN;

    @Column(length = 2000)
    private String adminComment;

    @Lob
    @com.fasterxml.jackson.annotation.JsonIgnore
    private byte[] attachmentData;

    private String contentType;

    private String originalFileName;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
