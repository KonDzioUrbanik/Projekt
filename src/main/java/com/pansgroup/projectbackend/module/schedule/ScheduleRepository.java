package com.pansgroup.projectbackend.module.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleRepository extends JpaRepository<ScheduleEntry,Long> {
}
