package com.pansgroup.projectbackend.module.calendar;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarEventDto {
    private Long id;
    private String title;
    private LocalDate dateFrom;
    private LocalDate dateTo;
    private CalendarEventType type;
    private String markerColor;
    private String formattedDateRange;
    
    private String room;     // np. "Sala 304, Budynek B"
    private String teacher;  // np. "dr Jan Kowalski"
}