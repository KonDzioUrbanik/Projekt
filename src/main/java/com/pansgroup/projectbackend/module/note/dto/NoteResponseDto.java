package com.pansgroup.projectbackend.module.note.dto;

import java.time.LocalDateTime;

public record NoteResponseDto(
        Long id,
        String title,
        String content,
        Long userId,
        String userFirstName,
        String userLastName,
        String visibility,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String studentGroupName) {
}
