package com.pansgroup.projectbackend.module.wordle;

import com.pansgroup.projectbackend.module.wordle.dto.WordleGameResponseDto;
import com.pansgroup.projectbackend.module.wordle.dto.WordleGuessDto;
import com.pansgroup.projectbackend.module.wordle.dto.WordleStatsDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/wordle")
public class WordleController {

    private final WordleService wordleService;

    public WordleController(WordleService wordleService) {
        this.wordleService = wordleService;
    }

    @GetMapping("/today")
    public WordleGameResponseDto getTodayGame() {
        return wordleService.getTodayGame();
    }

    @PostMapping("/guess")
    public ResponseEntity<?> submitGuess(@Valid @RequestBody WordleGuessDto dto) {
        String guess = dto.guess().toUpperCase();

        if (!wordleService.isValidWord(dto.guess())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Nieznane słowo. Spróbuj innego."));
        }

        try {
            WordleGameResponseDto result = wordleService.submitGuess(guess);
            return ResponseEntity.ok(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/stats")
    public WordleStatsDto getStats() {
        return wordleService.getStats();
    }

    // ─── Admin ───────────────────────────────────────────────────────

    @GetMapping("/admin/info")
    public Map<String, Object> getAdminInfo() {
        return wordleService.getAdminInfo();
    }

    @PostMapping("/admin/reroll")
    public Map<String, Object> rerollWord() {
        return wordleService.rerollTodayWord();
    }
}
