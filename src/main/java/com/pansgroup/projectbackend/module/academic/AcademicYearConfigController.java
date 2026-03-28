package com.pansgroup.projectbackend.module.academic;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * REST API dla konfiguracji roku akademickiego.
 * GET dostępny dla wszystkich zalogowanych użytkowników.
 * PUT wymaga roli ADMIN.
 */
@RestController
@RequestMapping("/api/academic-year")
public class AcademicYearConfigController {

    private final AcademicYearConfigService service;

    public AcademicYearConfigController(AcademicYearConfigService service) {
        this.service = service;
    }

    /**
     * Pobierz aktualną konfigurację roku akademickiego.
     * Używane przez frontend kalendarza, postęp semestru i inne moduły.
     */
    @GetMapping("/current")
    public ResponseEntity<AcademicYearConfigDto> getCurrent() {
        return service.findCurrent()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Aktualizuj konfigurację roku akademickiego.
     * Dostępne tylko dla administratora.
     */
    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AcademicYearConfigDto> update(@RequestBody AcademicYearConfigDto dto) {
        return ResponseEntity.ok(service.update(dto));
    }
}
