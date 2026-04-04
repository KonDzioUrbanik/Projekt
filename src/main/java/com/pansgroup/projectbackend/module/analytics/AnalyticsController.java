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
    @PreAuthorize("isAuthenticated()")
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
}
