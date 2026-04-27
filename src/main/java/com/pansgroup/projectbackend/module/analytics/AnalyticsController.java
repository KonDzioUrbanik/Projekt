package com.pansgroup.projectbackend.module.analytics;

import com.pansgroup.projectbackend.module.analytics.dto.AnalyticsEventDto;
import com.pansgroup.projectbackend.module.analytics.dto.AnalyticsSummaryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;

import com.pansgroup.projectbackend.module.system.SystemService;

@Slf4j
@RestController
@RequestMapping("/api/preferences")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService service;
    private final SystemService systemService;

    /**
     * Endpoint do odbioru zdarzeń analitycznych z frontendu.
     * Dostępny dla STUDENT i STAROSTA. ADMIN jest odrzucany w serwisie.
     */
    @PostMapping("/sync")
    @PreAuthorize("permitAll()") // Pozwalamy na logowanie zdarzeń (np. wejście na stronę logowania) dla anonimów
    public ResponseEntity<?> track(@Valid @RequestBody AnalyticsEventDto dto,
            Authentication auth) {
        if (!systemService.isModuleEnabled("module_analytics")) {
            // Zwracamy ciche 200 OK, aby nie spamować konsoli błędami po stronie klienta
            return ResponseEntity.ok().build();
        }
        try {
            service.saveEvent(dto, auth);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Błąd podczas przetwarzania analityki: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage() + " | Cause: "
                    + (e.getCause() != null ? e.getCause().getMessage() : "none"));
        }
    }

    /**
     * Zagregowane statystyki dla panelu administratora.
     */
    @GetMapping("/state")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AnalyticsSummaryDto> getSummary() {
        return ResponseEntity.ok(service.getSummary());
    }

    /**
     * Usuwa konkretny błąd z bazy danych.
     */
    @DeleteMapping("/errors")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteError(@RequestParam String eventName) {
        try {
            service.deleteError(eventName);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Błąd podczas usuwania błędu: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    /**
     * Usuwa wszystkie błędy z bazy danych.
     */
    @DeleteMapping("/errors/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteAllErrors() {
        try {
            service.deleteAllErrors();
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Błąd podczas usuwania wszystkich błędów: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    /**
     * Ręczne wymuszenie odświeżenia (wyczyszczenia) cache analityki.
     */
    @PostMapping("/refresh")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> refreshCache() {
        try {
            service.refreshCache();
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Błąd podczas odświeżania cache: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }
    /**
     * Szczegółowa ścieżka aktywności konkretnego użytkownika (User Journey).
     * Dostępny tylko dla ADMIN.
     */
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getUserJourney(
            @PathVariable Long userId,
            @org.springframework.web.bind.annotation.RequestParam(value = "limit", defaultValue = "100") int limit) {
        try {
            return ResponseEntity.ok(service.getUserJourney(userId, limit));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
        } catch (Exception e) {
            log.error("Błąd podczas pobierania ścieżki użytkownika: {}", e.getMessage());
            return ResponseEntity.internalServerError().body("Błąd serwera");
        }
    }
}
