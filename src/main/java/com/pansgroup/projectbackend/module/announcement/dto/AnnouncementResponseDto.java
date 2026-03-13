package com.pansgroup.projectbackend.module.announcement.dto;

import java.time.LocalDateTime;

public record AnnouncementResponseDto(
        Long id,
        String title,
        String content,
        LocalDateTime createdAt,
        Long authorId,
        String authorFirstName,
        String authorLastName,
        Long targetGroupId,
        String targetGroupName
) {
}
