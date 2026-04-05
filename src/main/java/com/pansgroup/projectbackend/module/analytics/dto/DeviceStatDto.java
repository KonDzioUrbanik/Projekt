package com.pansgroup.projectbackend.module.analytics.dto;

/**
 * DTO dla statystyk urządzeń i systemów.
 */
public record DeviceStatDto(
        String deviceInfo,
        long count
) {}
