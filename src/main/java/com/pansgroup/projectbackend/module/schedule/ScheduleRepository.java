package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.lang.NonNull;

import java.util.List;

public interface ScheduleRepository extends JpaRepository<ScheduleEntry,Long> {
    
    @NonNull
    @Override
    @EntityGraph(attributePaths = {"occurrences", "studentGroups"})
    List<ScheduleEntry> findAll();
    
    @EntityGraph(attributePaths = {"occurrences", "studentGroups"})
    List<ScheduleEntry> findByStudentGroups(StudentGroup studentGroup);
    
    long countByStudentGroups(StudentGroup studentGroup);
    
    @EntityGraph(attributePaths = {"occurrences", "studentGroups"})
    List<ScheduleEntry> findByYearPlanIgnoreCase(String yearPlan);
}
