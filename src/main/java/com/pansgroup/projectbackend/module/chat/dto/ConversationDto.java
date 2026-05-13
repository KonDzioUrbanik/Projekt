package com.pansgroup.projectbackend.module.chat.dto;

import java.time.LocalDateTime;

public record ConversationDto(
        Long id,
        Long otherUserId,
        String otherUserName,
        String otherUserEmail,
        String fieldOfStudy,
        Integer yearOfStudy,
        String role,
        long unreadCount,
        String lastMessagePreview,
        LocalDateTime lastMessageAt
) {}
