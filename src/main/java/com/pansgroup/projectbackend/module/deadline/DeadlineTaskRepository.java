package com.pansgroup.projectbackend.module.deadline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DeadlineTaskRepository extends JpaRepository<DeadlineTask, Long> {

    /**
     * Pobiera wszystkie terminy dostępne dla użytkownika:
     * 1. Prywatne, które sam stworzył.
     * 2. Grupowe przypisane do jego grupy dziekańskiej.
     * Automatycznie odcina zadania, których termin minął ponad 3 dni temu.
     */
    @Query("""
        SELECT d FROM DeadlineTask d
        LEFT JOIN FETCH d.author
        LEFT JOIN FETCH d.group
        WHERE (
            (d.visibility = 'PRIVATE' AND d.author.id = :userId)
            OR
            (d.visibility = 'GROUP' AND d.group.id = :groupId)
        )
        AND d.dueDate >= :cutoff
        ORDER BY d.dueDate ASC
    """)
    List<DeadlineTask> findAllForUser(
            @Param("userId") Long userId,
            @Param("groupId") Long groupId,
            @Param("cutoff") LocalDateTime cutoff
    );

    /**
     * Jak wyżej, ale dla użytkowników bez grupy (zwraca tylko prywatne).
     */
    @Query("""
        SELECT d FROM DeadlineTask d
        LEFT JOIN FETCH d.author
        WHERE d.visibility = 'PRIVATE'
        AND d.author.id = :userId
        AND d.dueDate >= :cutoff
        ORDER BY d.dueDate ASC
    """)
    List<DeadlineTask> findPrivateForUser(
            @Param("userId") Long userId,
            @Param("cutoff") LocalDateTime cutoff
    );

    /** Liczba zadań grupowych dodanych przez użytkownika w ciągu doby (rate limiting). */
    @Query("""
        SELECT COUNT(d) FROM DeadlineTask d
        WHERE d.author.id = :userId
        AND d.visibility = 'GROUP'
        AND d.createdAt >= :since
    """)
    long countGroupTasksCreatedByUserSince(
            @Param("userId") Long userId,
            @Param("since") LocalDateTime since
    );

    /** Liczba wszystkich zadań PRYWATNYCH dodanych przez użytkownika w ciągu doby (rate limiting DoS). */
    @Query("""
        SELECT COUNT(d) FROM DeadlineTask d
        WHERE d.author.id = :userId
        AND d.visibility = 'PRIVATE'
        AND d.createdAt >= :since
    """)
    long countPrivateTasksCreatedByUserSince(
            @Param("userId") Long userId,
            @Param("since") LocalDateTime since
    );
}
