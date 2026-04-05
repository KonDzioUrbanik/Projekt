package com.pansgroup.projectbackend.module.chat.dto;

import java.time.LocalDateTime;

public record MessageDto(
        Long id,
        Long conversationId,
        Long senderId,
        String senderName,
        String content,         // null if deleted
        LocalDateTime sentAt,
        LocalDateTime editedAt, // null if not edited
        LocalDateTime deletedAt, // null if not deleted
        String status,          // SENT / DELIVERED / READ
        boolean mine            // true if sender == current user
) {}
