package com.pansgroup.projectbackend.module.deadline.dto;

import com.pansgroup.projectbackend.module.deadline.DeadlineTaskType;
import com.pansgroup.projectbackend.module.deadline.DeadlineVisibility;

import java.time.LocalDateTime;

public record DeadlineResponseDto(
        Long id,
        String title,
        String description,
        String courseName,
        LocalDateTime dueDate,
        DeadlineTaskType taskType,
        DeadlineVisibility visibility,
        String authorName,
        Long authorId,
        String groupName,
        LocalDateTime createdAt,
        boolean canEdit  // true jeśli zalogowany użytkownik może edytować/usuwać
) {}
