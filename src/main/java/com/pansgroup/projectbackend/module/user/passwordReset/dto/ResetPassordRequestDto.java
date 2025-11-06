package com.pansgroup.projectbackend.module.user.passwordReset.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPassordRequestDto(
        @NotBlank(message = "{user.password.notBlank}")
        String token,
        @Size(min = 6, message = "{user.password.size}")
        @NotBlank(message = "{user.password.notBlank}")
        String newPassword,
        @NotBlank(message = "{user.password.notBlank}")
        String confirmPassword
) {}
