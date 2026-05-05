package com.pansgroup.projectbackend.module.wordle;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "portal_wordle_attempts",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "game_date"}))
@Getter
@Setter
public class WordleAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "game_date", nullable = false)
    private LocalDate gameDate;

    /** JSON array of guesses, e.g. ["STARY","WALKA"] */
    @Column(columnDefinition = "TEXT")
    private String guesses;

    @Column(nullable = false)
    private boolean solved = false;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
