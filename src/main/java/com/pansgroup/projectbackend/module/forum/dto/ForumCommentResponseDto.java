package com.pansgroup.projectbackend.module.forum.dto;

import java.time.LocalDateTime;
import java.util.List;

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
        long voteScore,
        String currentUserVote, // "UPVOTE", "DOWNVOTE", or null
        boolean canEdit,
        boolean canDelete,
        boolean deleted,
        List<AttachmentResponseDto> attachments
) {
}


