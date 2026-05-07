package com.pansgroup.projectbackend.module.notification.dto;

public record NotificationSettingsDto(
        boolean notifyForum,
        boolean notifySurveys,
        boolean notifyChat,
        boolean notifyFriends,
        boolean notifyAnnouncements
) {}
