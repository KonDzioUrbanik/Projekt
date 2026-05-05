package com.pansgroup.projectbackend.module.wordle;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface WordleWordRepository extends JpaRepository<WordleWord, Long> {
    Optional<WordleWord> findByGameDate(LocalDate gameDate);
    boolean existsByWord(String word);
}
