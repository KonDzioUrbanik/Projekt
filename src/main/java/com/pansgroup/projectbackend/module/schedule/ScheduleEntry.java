package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "schedule_entries")
public class ScheduleEntry {

    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    private Long id;

    private String title;

    /**
     * Prowadzący – serializowani jako JSON array, np. ["Jan Kowalski","Anna Nowak"]
     */
    @Column(columnDefinition = "text")
    private String teachers;

    @Enumerated(EnumType.STRING)
    private ClassType classType;

    @Enumerated(EnumType.STRING)
    private CreditType creditType;

    @Column(length = 2000)
    private String yearPlan;

    /** Numer podgrupy laboratoryjnej/ćwiczeniowej (np. "L1", "C2") */
    @Column(length = 20)
    private String groupNumber;

    /** Specjalizacja (opcjonalnie, np. "Bazy danych") */
    @Column(length = 100)
    private String specialization;

    @ManyToMany(fetch = FetchType.LAZY)
    private Set<StudentGroup> studentGroups = new HashSet<>();

    @OneToMany(mappedBy = "entry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ScheduleOccurrence> occurrences = new ArrayList<>();

    private Boolean archived = false;

    private LocalDateTime archivedAt;
}
