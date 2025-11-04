package com.pansgroup.projectbackend.module.student;

import com.pansgroup.projectbackend.module.schedule.ScheduleEntry;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity(name = "student_groups")
public class StudentGroup {

    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    private Long id;
    private String name;

    @ManyToMany(mappedBy = "studentGroups")
    List<ScheduleEntry> scheduleEntries;

}
