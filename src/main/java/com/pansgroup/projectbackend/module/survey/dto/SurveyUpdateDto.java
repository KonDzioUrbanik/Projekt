package com.pansgroup.projectbackend.module.survey.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SurveyUpdateDto(
        @NotBlank(message = "Tytul ankiety jest wymagany")
        @Size(max = 180, message = "Tytul moze miec maksymalnie 180 znakow")
        String title,

        @Size(max = 2000, message = "Opis moze miec maksymalnie 2000 znakow")
        String description
) {
}
