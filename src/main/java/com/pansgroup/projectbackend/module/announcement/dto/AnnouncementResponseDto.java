package com.pansgroup.projectbackend.module.announcement.dto;

import com.pansgroup.projectbackend.module.announcement.AnnouncementPriority;

import java.time.LocalDateTime;
import java.util.List;

public record AnnouncementResponseDto(
        Long id,
        String title,
        String content,
        LocalDateTime createdAt,
        Long authorId,
        String authorFirstName,
        String authorLastName,
        Long targetGroupId,
        String targetGroupName,
        boolean canDelete,
        boolean canConfirmRead,
        boolean readByCurrentUser,
        boolean canViewReadStats,
        long readConfirmationsCount,
        AnnouncementPriority priority,
        boolean isPinned,
        boolean isGlobal,
        List<AttachmentResponseDto> attachments
) {
}
