package com.pansgroup.projectbackend.module.student;

import com.pansgroup.projectbackend.module.schedule.ScheduleEntry;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "student_groups")
public class StudentGroup {

    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    private Long id;
    private String name;

    @ManyToMany(mappedBy = "studentGroups")
    List<ScheduleEntry> scheduleEntries;

    @Column(nullable = false, columnDefinition = "bigint default 2147483648")
    private Long storageLimit = 2147483648L; // 2GB

    @Column(nullable = false, columnDefinition = "bigint default 0")
    private Long usedStorage = 0L;

}
