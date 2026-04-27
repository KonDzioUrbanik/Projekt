package com.pansgroup.projectbackend.module.feedback;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "feedback_notes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feedback_id", nullable = false)
    private Long feedbackId;

    @Column(nullable = false, length = 2000)
    private String content;

    @Column(nullable = false, length = 255)
    private String authorEmail;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
