package com.pansgroup.projectbackend.module.user.dto;

import jakarta.validation.constraints.NotNull;

public record UserActivationUpdateDto(
        @NotNull Boolean activated
) {
}