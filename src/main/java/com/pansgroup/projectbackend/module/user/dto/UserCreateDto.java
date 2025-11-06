package com.pansgroup.projectbackend.module.user.dto;

import jakarta.validation.constraints.*;

public record UserCreateDto(
        @NotBlank(message="{user.firstName.notBlank}")
        @Size(min=2,max=30,message="{user.firstName.size}")
        String firstName,

        @NotBlank(message="{user.lastName.notBlank}")
        @Size(min=2,max=30,message="{user.lastName.size}")
        String lastName,

        @NotBlank(message="{user.email.notBlank}")
        @Email(message="{user.email.invalid}")
        String email,

        @NotBlank(message="{user.password.notBlank}")
        @Size(min=6,message="{user.password.size}")
        String password

) {}
