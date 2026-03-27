package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Getter
@Setter
@Entity(name = "schedule_entries")
public class ScheduleEntry {

    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    private Long id;

    private String title;

    private String room;

    private String teacher;

    @Enumerated(EnumType.STRING)
    private DayOfWeek dayOfWeek;

    private LocalTime startTime;

    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    private ClassType classType;

    @Column(length = 2000)
    private String yearPlan; // np. INFORMATYKA ROK III itp.

    /** Numer podgrupy laboratoryjnej/ćwiczeniowej (np. "L1", "C2") */
    @Column(length = 20)
    private String groupNumber;

    /** Specjalizacja (opcjonalnie, np. "Bazy danych") */
    @Column(length = 100)
    private String specialization;

    @ManyToMany(fetch = FetchType.LAZY)
    private List<StudentGroup> studentGroups;

    @Enumerated(EnumType.STRING)
    private WeekType weekType;

    @Column(length = 512)
    private String customWeeks; // np. "1,3,7,11" (numery tygodni ISO)

    private Boolean archived = false;

    private LocalDateTime archivedAt;
}
