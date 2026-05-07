package com.pansgroup.projectbackend.module.wordle.dto;

public record WordleRankingDto(
    String firstName,
    String lastName,
    long gamesWon
) {}
