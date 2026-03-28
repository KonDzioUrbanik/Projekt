package com.pansgroup.projectbackend.module.academic;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * Konfiguracja roku akademickiego.
 * Przechowuje daty semestrów i nazwę roku, używane w kalendarzu,
 * module postępu semestru i innych komponentach wymagających ram czasowych.
 * W danej chwili powinna istnieć tylko jedna aktywna konfiguracja.
 */
@Entity
@Table(name = "academic_year_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AcademicYearConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nazwa roku akademickiego, np. "2025/2026" */
    @Column(nullable = false, length = 20)
    private String academicYear;

    /** Semestr zimowy – data rozpoczęcia zajęć */
    @Column(nullable = false)
    private LocalDate winterSemesterStart;

    /** Semestr zimowy – data zakończenia (koniec sesji) */
    @Column(nullable = false)
    private LocalDate winterSemesterEnd;

    /** Semestr letni – data rozpoczęcia zajęć */
    @Column(nullable = false)
    private LocalDate summerSemesterStart;

    /** Semestr letni – data zakończenia (koniec sesji) */
    @Column(nullable = false)
    private LocalDate summerSemesterEnd;

    /** Data pierwszego tygodnia "A" – punkt startowy dla algorytmu A/B (opcjonalne, przeznaczone na przyszłość) */
    @Column(nullable = true)
    private LocalDate weekAStartDate;
}
