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
    List<ScheduleEntry> findByArchivedFalse();
    
    @EntityGraph(attributePaths = {"occurrences", "studentGroups"})
    List<ScheduleEntry> findByStudentGroups(StudentGroup studentGroup);

    @EntityGraph(attributePaths = {"occurrences", "studentGroups"})
    List<ScheduleEntry> findByStudentGroupsInAndArchivedFalse(java.util.Collection<StudentGroup> studentGroups);
    
    long countByStudentGroups(StudentGroup studentGroup);
    
    @EntityGraph(attributePaths = {"occurrences", "studentGroups"})
    List<ScheduleEntry> findByYearPlanIgnoreCase(String yearPlan);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE ScheduleEntry e SET e.archived = true, e.archivedAt = CURRENT_TIMESTAMP " +
            "WHERE e.archived = false AND (:yearPlan IS NULL OR e.yearPlan = :yearPlan)")
    int archiveActivePlans(@org.springframework.data.repository.query.Param("yearPlan") String yearPlan);
}
