package com.pansgroup.projectbackend.dto;

import java.time.LocalDateTime;

public record NoteResponseDto(
        Long id,
        String title,
        String content,
        Long userId,
        String userFirstName,
        String userLastName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}

