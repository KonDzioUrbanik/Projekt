package com.pansgroup.projectbackend.module.wordle.dto;

public record WordleStatsDto(
    long gamesPlayed,
    long gamesWon,
    int winPercentage,
    long currentStreak,
    long maxStreak,
    java.util.Map<Integer, Integer> guessDistribution
) {}
