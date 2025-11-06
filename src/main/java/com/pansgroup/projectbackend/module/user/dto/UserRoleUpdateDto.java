package com.pansgroup.projectbackend.module.user.dto;


import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Metoda zmiany roli ADMIN / STUDENT / STAROSTA")
public record UserRoleUpdateDto(
        @NotBlank(message = "{user.role.notBlank}")
        String newRole
) {
}
