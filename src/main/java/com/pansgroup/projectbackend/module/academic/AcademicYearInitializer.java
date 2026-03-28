package com.pansgroup.projectbackend.module.academic;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Inicjalizuje domyślną konfigurację roku akademickiego 2025/2026
 * przy pierwszym uruchomieniu aplikacji (jeśli baza danych jest pusta).
 * Daty odpowiadają harmonogramowi PANS Jarosław.
 */
@Component
public class AcademicYearInitializer {

    private final AcademicYearConfigService service;

    public AcademicYearInitializer(AcademicYearConfigService service) {
        this.service = service;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initialize() {
        AcademicYearConfigDto defaults = AcademicYearConfigDto.builder()
                .academicYear("2025/2026")
                // Semestr zimowy: 1 październik 2025 – 22 luty 2026
                .winterSemesterStart(LocalDate.of(2025, 10, 1))
                .winterSemesterEnd(LocalDate.of(2026, 2, 22))
                // Semestr letni: 23 luty 2026 – 30 wrzesień 2026
                .summerSemesterStart(LocalDate.of(2026, 2, 23))
                .summerSemesterEnd(LocalDate.of(2026, 9, 30))
                // Pierwszy tydzień A: 6 październik 2025 (Pn pierwszego tyg. dydaktycznego)
                .weekAStartDate(LocalDate.of(2025, 10, 6))
                .build();

        service.initializeIfAbsent(defaults);
    }
}
