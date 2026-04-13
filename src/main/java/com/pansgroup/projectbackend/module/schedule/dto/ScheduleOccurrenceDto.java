package com.pansgroup.projectbackend.module.schedule.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record ScheduleOccurrenceDto(
        Long id,
        @NotNull(message = "Data i godzina rozpoczęcia jest wymagana.") LocalDateTime startDateTime,
        @NotNull(message = "Data i godzina zakończenia jest wymagana.")  LocalDateTime endDateTime,
        @Size(max = 50)  String room,
        @Size(max = 50)  String buildingCode,
        @Size(max = 200) String location
) {
}
