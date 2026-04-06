package com.pansgroup.projectbackend.module.forum.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ForumThreadUpdateDto(
        @NotBlank(message = "Tytul watku jest wymagany.")
        @Size(max = 180, message = "Tytul watku nie moze miec wiecej niz {max} znakow.")
        String title,

        @NotBlank(message = "Tresc watku jest wymagana.")
        @Size(max = 4000, message = "Tresc watku nie moze miec wiecej niz {max} znakow.")
        String content
) {
}

