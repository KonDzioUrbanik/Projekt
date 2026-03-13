package com.pansgroup.projectbackend.module.calendar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    // Sortowanie po dacie rozpoczęcia
    List<CalendarEvent> findAllByOrderByDateFromAsc();

    // Znajdź aktywne zdarzenie blokujące (BREAK, HOLIDAY, EXAM) dla danej daty
    @Query("SELECT e FROM CalendarEvent e WHERE e.type IN :types AND :date BETWEEN e.dateFrom AND e.dateTo ORDER BY e.dateFrom ASC")
    List<CalendarEvent> findActiveEventsByTypesAndDate(@Param("types") List<CalendarEventType> types,
            @Param("date") LocalDate date);
}
