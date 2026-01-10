package com.pansgroup.projectbackend.module.schedule.dto;

import com.pansgroup.projectbackend.module.schedule.ClassType;
import com.pansgroup.projectbackend.module.schedule.DayOfWeek;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.util.List;

public record ScheduleEntryCreateDto(
        @NotBlank(message = "Tytuł jest wymagany.")
        @Size(min = 3, max = 255, message = "Tytuł musi mieć od {min} do {max} znaków.")
        String title,

        @NotBlank(message = "Sala jest wymagana.")
        @Size(min = 1, max = 50, message = "Sala musi mieć od {min} do {max} znaków.")
        String room,

        @NotBlank(message = "Nauczyciel jest wymagany.")
        @Size(min = 3, max = 255, message = "Nauczyciel musi mieć od {min} do {max} znaków.")
        String teacher,

        @NotNull(message = "Dzień tygodnia jest wymagany.")
        DayOfWeek dayOfWeek,

        @NotNull(message = "Godzina rozpoczęcia jest wymagana.")
        LocalTime startTime,

        @NotNull(message = "Godzina zakończenia jest wymagana.")
        LocalTime endTime,

        @NotNull(message = "Typ zajęć jest wymagany.")
        ClassType classType,

        List<Long> studentGroupIds
) {
}