package com.pansgroup.projectbackend.module.schedule.dto;

import com.pansgroup.projectbackend.module.schedule.ClassType;
import com.pansgroup.projectbackend.module.schedule.CreditType;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;

import java.time.LocalDateTime;
import java.util.List;

public record ScheduleEntryResponseDto(
        Long id,
        String title,
        List<String> teachers,
        ClassType classType,
        CreditType creditType,
        List<StudentGroupResponseDto> studentGroups,
        List<ScheduleOccurrenceDto> occurrences,
        Boolean archived,
        LocalDateTime archivedAt,
        String groupNumber,
        String specialization,
        String yearPlan
) {
}