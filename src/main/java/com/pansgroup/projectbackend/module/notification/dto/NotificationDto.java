package com.pansgroup.projectbackend.module.notification.dto;

import com.pansgroup.projectbackend.module.notification.NotificationType;
import java.time.LocalDateTime;

public record NotificationDto(
        Long id,
        NotificationType type,
        String message,
        String referenceUrl,
        boolean isRead,
        LocalDateTime createdAt
) {}
