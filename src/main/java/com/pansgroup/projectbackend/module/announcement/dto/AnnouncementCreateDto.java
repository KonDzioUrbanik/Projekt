package com.pansgroup.projectbackend.module.announcement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnnouncementCreateDto(
        @NotBlank(message = "Tytuł jest wymagany.")
        @Size(max = 150, message = "Tytuł nie może mieć więcej niż {max} znaków.")
        String title,

        @NotBlank(message = "Treść jest wymagana.")
        String content
) {
}
