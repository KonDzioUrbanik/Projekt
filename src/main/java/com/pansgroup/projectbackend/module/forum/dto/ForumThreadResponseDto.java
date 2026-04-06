package com.pansgroup.projectbackend.module.forum.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ForumThreadResponseDto(
        Long id,
        String title,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long authorId,
        String authorFirstName,
        String authorLastName,
        String authorRole,
        Long groupId,
        String groupName,
        boolean locked,
        boolean archived,
        boolean pinned,
        long likeCount,
        boolean likedByCurrentUser,
        boolean canEdit,
        boolean canDelete,
        boolean canModerate,
        List<ForumCommentResponseDto> comments
) {
}



