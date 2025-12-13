package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScheduleRepository extends JpaRepository<ScheduleEntry,Long> {
    List<ScheduleEntry> findByStudentGroups(StudentGroup studentGroup);
    List<ScheduleEntry> findByYearPlanIgnoreCase(String yearPlan);
}
