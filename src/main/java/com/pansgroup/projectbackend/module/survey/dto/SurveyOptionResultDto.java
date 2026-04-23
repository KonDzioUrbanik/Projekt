package com.pansgroup.projectbackend.module.survey.dto;

public record SurveyOptionResultDto(
        Long id,
        String text,
        long votes,
        double percentage,
        boolean selectedByCurrentUser
) {
}

