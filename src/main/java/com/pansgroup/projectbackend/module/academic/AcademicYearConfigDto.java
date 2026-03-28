package com.pansgroup.projectbackend.module.academic;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.time.LocalDate;

/**
 * DTO do transferu i zapisu konfiguracji roku akademickiego.
 * Pola `winterSemesterLabel` i `summerSemesterLabel` zawierają
 * gotowe opisy zakresów dat (np. "1 października 2025 - 22 lutego 2026")
 * przeznaczone dla szablonów Thymeleaf – bez potrzeby kompleksowych wyrażeń.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AcademicYearConfigDto {

    private Long id;

    /** Nazwa roku akademickiego, np. "2025/2026" */
    private String academicYear;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate winterSemesterStart;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate winterSemesterEnd;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate summerSemesterStart;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate summerSemesterEnd;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate weekAStartDate;

    /** Gotowy opis semestru zimowego do wyświetlenia w HTML (bez Thymeleaf expressions). */
    private String winterSemesterLabel;

    /** Gotowy opis semestru letniego do wyświetlenia w HTML (bez Thymeleaf expressions). */
    private String summerSemesterLabel;
}
