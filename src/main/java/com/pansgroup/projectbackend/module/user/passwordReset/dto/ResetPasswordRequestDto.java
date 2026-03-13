package com.pansgroup.projectbackend.module.user.passwordReset.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequestDto(
                @NotBlank(message = "{user.password.notBlank}") String token,
                @NotBlank(message = "{user.password.notBlank}") @Size(min = 8, message = "Hasło musi zawierać minimum 8 znaków") @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$", message = "Hasło musi zawierać: wielką literę, małą literę, cyfrę i znak specjalny (@$!%*?&)") String newPassword,
                @NotBlank(message = "{user.password.notBlank}") String confirmPassword) {
}
