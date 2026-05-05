package com.pansgroup.projectbackend.module.wordle;

import com.pansgroup.projectbackend.module.wordle.dto.WordleGameResponseDto;
import com.pansgroup.projectbackend.module.wordle.dto.WordleStatsDto;

import java.util.Map;

public interface WordleService {
    WordleGameResponseDto getTodayGame();
    WordleGameResponseDto submitGuess(String guess);
    WordleStatsDto getStats();
    boolean isValidWord(String word);

    // Admin operations
    Map<String, Object> getAdminInfo();
    Map<String, Object> rerollTodayWord();
}
