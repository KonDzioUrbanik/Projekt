package com.pansgroup.projectbackend.module.survey.dto;

import jakarta.validation.constraints.NotNull;

public record SurveyStatusUpdateDto(
        @NotNull(message = "Status ankiety jest wymagany")
        Boolean active
) {
}

