package com.pansgroup.projectbackend.module.survey.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record SurveyExtendDto(
        @NotNull(message = "Nowa data zakończenia jest wymagana")
        LocalDateTime endsAt
) {
}

