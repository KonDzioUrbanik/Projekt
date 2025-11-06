package com.pansgroup.projectbackend.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PasswordChangeDto {

    @NotBlank(message = "Obecne hasło jest wymagane")
    private String currentPassword;

    @NotBlank(message = "{user.password.notBlank}")
    @Size(min = 6, message = "{user.password.size}")
    private String newPassword;

    @NotBlank(message = "Potwierdzenie hasła jest wymagane")
    private String confirmPassword;
}

