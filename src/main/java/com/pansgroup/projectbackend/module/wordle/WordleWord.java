package com.pansgroup.projectbackend.module.wordle;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "portal_wordle_words")
@Getter
@Setter
public class WordleWord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String word;

    @Column(nullable = false, unique = true)
    private LocalDate gameDate;
}
