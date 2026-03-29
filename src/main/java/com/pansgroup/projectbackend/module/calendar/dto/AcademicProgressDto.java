package com.pansgroup.projectbackend.module.calendar.dto;

import com.pansgroup.projectbackend.module.calendar.CalendarEventDto;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AcademicProgressDto {
    private double semesterProgress; // 0-100
    private int currentDay;
    private int totalDays;
    private String currentWeekType; // "WEEK_A", "WEEK_B"
    private String semesterName; // "zimowy", "letni"
    
    private CalendarEventDto nearestBreak;
    private Long daysToBreak;
    
    private CalendarEventDto nearestSession;
    private Long daysToSession;
    
    private LocalDate semesterStart;
    private LocalDate semesterEnd;
    private int currentWeek;
    private int totalWeeks;
    
    private List<MilestoneDto> milestones;
    
    private List<CalendarEventDto> timelineEvents;
}
