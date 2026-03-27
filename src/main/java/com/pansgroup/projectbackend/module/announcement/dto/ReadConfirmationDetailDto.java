package com.pansgroup.projectbackend.module.announcement.dto;

import java.time.LocalDateTime;

public record ReadConfirmationDetailDto(
        Long userId,
        String firstName,
        String lastName,
        LocalDateTime confirmedAt
) {}
