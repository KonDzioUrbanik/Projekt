package com.pansgroup.projectbackend.module.survey.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
public record SurveyVoteRequestDto(
        @NotEmpty(message = "Wybierz odpowiedz")
        List<Long> optionIds
) {
}

