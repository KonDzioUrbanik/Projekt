package com.pansgroup.projectbackend.module.schedule.dto;

import com.pansgroup.projectbackend.module.schedule.ClassType;
import com.pansgroup.projectbackend.module.schedule.DayOfWeek;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;

import java.time.LocalTime;
import java.util.List;

public record ScheduleEntryResponseDto(
        Long id,
        String title,
        String room,
        String teacher,
        DayOfWeek dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        ClassType classType,
        List<StudentGroupResponseDto> studentGroups
) {
}