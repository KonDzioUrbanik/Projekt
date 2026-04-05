package com.pansgroup.projectbackend.module.analytics.dto;

import com.pansgroup.projectbackend.module.analytics.AnalyticsEvent.EventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AnalyticsEventDto(
        @NotBlank @Size(max = 64) String sessionId,
        @NotNull EventType eventType,
        @Size(max = 255) String eventName,
        @NotBlank @Size(max = 255) String page,
        Long durationMs
) {}
