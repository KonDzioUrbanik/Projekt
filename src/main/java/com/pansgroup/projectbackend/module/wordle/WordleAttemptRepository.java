package com.pansgroup.projectbackend.module.wordle;

import com.pansgroup.projectbackend.module.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Optional;

public interface WordleAttemptRepository extends JpaRepository<WordleAttempt, Long> {

    Optional<WordleAttempt> findByUserAndGameDate(User user, LocalDate gameDate);

    long countByUserAndSolvedTrue(User user);

    long countByUser(User user);

    @Query("""
           SELECT COUNT(a) FROM WordleAttempt a
           WHERE a.user = :user
             AND a.solved = true
             AND a.gameDate >= :since
             AND NOT EXISTS (
                 SELECT 1 FROM WordleAttempt a2
                 WHERE a2.user = :user
                   AND a2.solved = false
                   AND a2.gameDate >= :since
                   AND a2.gameDate <= a.gameDate
             )
           """)
    long countCurrentStreak(User user, LocalDate since);
}
