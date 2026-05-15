package com.pansgroup.projectbackend.module.deadline.dto;

import com.pansgroup.projectbackend.module.deadline.DeadlineTaskType;
import com.pansgroup.projectbackend.module.deadline.DeadlineVisibility;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record DeadlineCreateDto(

        @NotBlank(message = "Tytuł jest wymagany.")
        @Size(max = 120, message = "Tytuł może mieć maksymalnie 120 znaków.")
        String title,

        @Size(max = 500, message = "Opis może mieć maksymalnie 500 znaków.")
        String description,

        @Size(max = 80, message = "Nazwa przedmiotu może mieć maksymalnie 80 znaków.")
        String courseName,

        @NotNull(message = "Data terminu jest wymagana.")
        @Future(message = "Data terminu musi być w przyszłości.")
        LocalDateTime dueDate,

        @NotNull(message = "Typ zadania jest wymagany.")
        DeadlineTaskType taskType,

        @NotNull(message = "Widoczność jest wymagana.")
        DeadlineVisibility visibility
) {}
