package com.pansgroup.projectbackend.module.forum.dto;

import java.time.LocalDateTime;

public record ForumCommentResponseDto(
        Long id,
        Long threadId,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long authorId,
        String authorFirstName,
        String authorLastName,
        String authorRole,
        boolean canEdit,
        boolean canDelete
) {
}


