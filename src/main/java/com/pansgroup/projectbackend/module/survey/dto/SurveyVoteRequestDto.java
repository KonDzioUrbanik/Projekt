package com.pansgroup.projectbackend.module.survey.dto;

import jakarta.validation.constraints.NotNull;

public record SurveyVoteRequestDto(
        @NotNull(message = "Wybierz odpowiedz")
        Long optionId
) {
}

