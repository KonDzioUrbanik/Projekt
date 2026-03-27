package com.pansgroup.projectbackend.module.announcement.dto;

import com.pansgroup.projectbackend.module.announcement.AnnouncementPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AnnouncementCreateDto(
        @NotBlank(message = "Tytuł jest wymagany.")
        @Size(max = 150, message = "Tytuł nie może mieć więcej niż {max} znaków.")
        String title,

        @NotBlank(message = "Treść jest wymagana.")
        @Size(max = 2000, message = "Treść nie może mieć więcej niż {max} znaków.")
        String content,

        Boolean global,

        List<Long> targetGroupIds,

        AnnouncementPriority priority,

        Boolean isPinned
) {
}
