package com.pansgroup.projectbackend.module.calendar;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "calendar_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private LocalDate dateFrom;

    @Column(nullable = false)
    private LocalDate dateTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CalendarEventType type;

    // Opcjonalny kolor markera (np. "red", "blue", "green", "purple")
    // Nadpisuje domyślny kolor wynikający z typu
    @Column
    private String markerColor;

    // Opcjonalnie: Semestr (WINTER, SUMMER) lub Rok Akademicki
    // Na razie uproszczone, bo widok i tak dzieli po datach

    // Metoda pomocnicza do formatowania daty w stylu "1 października - 21 grudnia"
    // Będzie używana po stronie frontendu lub DTO
}
