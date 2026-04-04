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

@Slf4j
@RestController
@RequestMapping("/api/activity")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService service;

    /**
     * Endpoint do odbioru zdarzeń analitycznych z frontendu.
     * Dostępny dla STUDENT i STAROSTA. ADMIN jest odrzucany w serwisie.
     */
    @PostMapping("/event")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> track(@Valid @RequestBody AnalyticsEventDto dto,
            Authentication auth) {
        try {
            service.saveEvent(dto, auth);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Błąd podczas przetwarzania analityki: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage() + " | Cause: " + (e.getCause() != null ? e.getCause().getMessage() : "none"));
        }
    }

    /**
     * Zagregowane statystyki dla panelu administratora.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AnalyticsSummaryDto> getSummary() {
        return ResponseEntity.ok(service.getSummary());
    }
}
