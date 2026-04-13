package com.pansgroup.projectbackend.module.schedule;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity(name = "schedule_occurrences")
public class ScheduleOccurrence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_entry_id", nullable = false)
    private ScheduleEntry entry;

    @Column(nullable = false)
    private LocalDateTime startDateTime;

    @Column(nullable = false)
    private LocalDateTime endDateTime;

    /** Numer sali, np. "201" */
    @Column(length = 50)
    private String room;

    /** Skrót budynku, np. "W20 A" */
    @Column(length = 50)
    private String buildingCode;

    /** Pełny adres, np. "Wyspiańskiego 20, budynek A" */
    @Column(length = 200)
    private String location;
}
