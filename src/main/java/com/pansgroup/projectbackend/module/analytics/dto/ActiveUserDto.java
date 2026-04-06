package com.pansgroup.projectbackend.module.analytics.dto;

import java.time.LocalDateTime;

public record ActiveUserDto(
    Long userId,
    String name,
    String lastPage,
    LocalDateTime lastActivity
) {}
