package com.pansgroup.projectbackend.module.analytics.dto;

public record UserActivityDto(Long userId, String fullName, long sessions, long totalEvents) {}
