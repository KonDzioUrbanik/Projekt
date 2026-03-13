package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

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

    @ManyToMany(fetch = FetchType.LAZY)
    private List<StudentGroup> studentGroups;

    @Enumerated(EnumType.STRING)
    private WeekType weekType;
}
