package com.pansgroup.projectbackend.module.schedule.dto;

import com.pansgroup.projectbackend.module.schedule.ClassType;
import com.pansgroup.projectbackend.module.schedule.DayOfWeek;

import java.time.LocalTime;

public record ScheduleEntryResponseDto(
        Long id,
        String title,
        String room,
        String teacher,
        DayOfWeek dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        ClassType classType,
        String yearPlan
) {
}