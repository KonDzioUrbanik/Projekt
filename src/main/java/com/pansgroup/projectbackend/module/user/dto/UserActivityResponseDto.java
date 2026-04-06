package com.pansgroup.projectbackend.module.user.dto;

import java.time.LocalDateTime;

public record UserActivityResponseDto(
    Long id,
    String type, // "NOTE", "FORUM_THREAD"
    String title,
    String contentSnippet,
    LocalDateTime createdAt,
    String meta // e.g. "Shared Note", "Forum Post"
) {}
