package com.pansgroup.projectbackend.module.analytics.dto;

import java.util.List;

/**
 * Zagregowane dane ścieżki użytkownika (User Journey) dla panelu admina.
 */
public record UserJourneyDto(
        Long userId,
        String fullName,
        String favoritePage,
        String totalTimeSpent,
        List<String> devices,
        List<String> encounteredErrors,
        List<TimelineEventDto> recentTimeline
) {}
