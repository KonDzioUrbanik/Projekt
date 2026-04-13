package com.pansgroup.projectbackend.module.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScheduleOccurrenceRepository extends JpaRepository<ScheduleOccurrence, Long> {

    List<ScheduleOccurrence> findByEntry(ScheduleEntry entry);

    void deleteByEntry(ScheduleEntry entry);
}
