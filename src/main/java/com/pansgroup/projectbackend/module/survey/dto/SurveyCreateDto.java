package com.pansgroup.projectbackend.module.survey.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public record SurveyCreateDto(
        @NotBlank(message = "Tytul ankiety jest wymagany")
        @Size(max = 180, message = "Tytul moze miec maksymalnie 180 znakow")
        String title,

        @Size(max = 2000, message = "Opis moze miec maksymalnie 2000 znakow")
        String description,

        @NotEmpty(message = "Podaj co najmniej dwie odpowiedzi")
        @Size(min = 2, max = 12, message = "Ankieta musi miec od 2 do 12 odpowiedzi")
        List<@NotBlank(message = "Tekst odpowiedzi nie moze byc pusty") @Size(max = 160, message = "Odpowiedz moze miec maksymalnie 160 znakow") String> options,

        Boolean global,
        Long targetGroupId,
        LocalDateTime endsAt,
        Boolean multipleChoice
) {
}

