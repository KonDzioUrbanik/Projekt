package com.pansgroup.projectbackend.module.schedule.dto;

import com.pansgroup.projectbackend.module.schedule.ClassType;
import com.pansgroup.projectbackend.module.schedule.CreditType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ScheduleEntryCreateDto(
        @NotBlank(message = "Tytuł jest wymagany.")
        @Size(min = 3, max = 255, message = "Tytuł musi mieć od {min} do {max} znaków.")
        String title,

        /** Lista prowadzących (min. 1) */
        @NotEmpty(message = "Co najmniej jeden prowadzący jest wymagany.")
        List<@NotBlank String> teachers,

        @NotNull(message = "Typ zajęć jest wymagany.")
        ClassType classType,

        CreditType creditType,

        List<Long> studentGroupIds,

        @Size(max = 20)
        String groupNumber,

        @Size(max = 100)
        String specialization,

        @Size(max = 2000)
        String yearPlan,

        /** Lista konkretnych terminów zajęć */
        @NotEmpty(message = "Co najmniej jeden termin zajęć jest wymagany.")
        @Valid
        List<ScheduleOccurrenceDto> occurrences
) {
}