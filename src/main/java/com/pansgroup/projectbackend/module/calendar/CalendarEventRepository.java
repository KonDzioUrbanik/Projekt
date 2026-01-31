package com.pansgroup.projectbackend.module.calendar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    // Sortowanie po dacie rozpoczęcia
    List<CalendarEvent> findAllByOrderByDateFromAsc();
}
