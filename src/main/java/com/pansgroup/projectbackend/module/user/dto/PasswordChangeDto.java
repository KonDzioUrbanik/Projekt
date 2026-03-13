package com.pansgroup.projectbackend.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PasswordChangeDto {

    @NotBlank(message = "Obecne hasło jest wymagane")
    private String currentPassword;

    @NotBlank(message = "{user.password.notBlank}")
    @Size(min = 8, message = "Hasło musi zawierać minimum 8 znaków")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$", message = "Hasło musi zawierać: wielką literę, małą literę, cyfrę i znak specjalny (@$!%*?&)")
    private String newPassword;

    @NotBlank(message = "Potwierdzenie hasła jest wymagane")
    private String confirmPassword;
}
