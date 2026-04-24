package com.pansgroup.projectbackend.module.survey.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SurveyResponseDto(
        Long id,
        String title,
        String description,
        Long authorId,
        String authorFirstName,
        String authorLastName,
        String authorRole,
        Long targetGroupId,
        String targetGroupName,
        boolean globalScope,
        boolean active,
        boolean expired,
        LocalDateTime endsAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        long totalVotes,
        boolean hasVoted,
        Long selectedOptionId,
        boolean canManage,
        boolean canVote,
        List<SurveyOptionResultDto> options
) {
}

