package com.pansgroup.projectbackend.module.wordle.dto;

import java.util.List;

public record WordleGameResponseDto(
    /** List of previous guesses with letter results */
    List<GuessResult> guesses,
    boolean solved,
    int attemptsLeft,
    boolean gameOver,
    /** Revealed only when game is over */
    String answer,
    int gameNumber
) {
    public record GuessResult(String word, List<LetterResult> letters) {}
    public record LetterResult(char letter, String status) {}
}
