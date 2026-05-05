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
    private String formattedDateRange; // Np. "1 października - 21 grudnia"
}
