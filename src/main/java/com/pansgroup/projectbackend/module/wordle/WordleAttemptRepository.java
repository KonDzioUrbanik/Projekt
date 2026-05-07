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

    java.util.List<WordleAttempt> findByUser(User user);

    @Query("SELECT new com.pansgroup.projectbackend.module.wordle.dto.WordleRankingDto(a.user.firstName, a.user.lastName, COUNT(a)) " +
           "FROM WordleAttempt a WHERE a.solved = true GROUP BY a.user.id, a.user.firstName, a.user.lastName ORDER BY COUNT(a) DESC")
    java.util.List<com.pansgroup.projectbackend.module.wordle.dto.WordleRankingDto> findTopPlayers(org.springframework.data.domain.Pageable pageable);

    void deleteByGameDate(LocalDate gameDate);
}
