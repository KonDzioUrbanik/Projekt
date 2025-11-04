package com.pansgroup.projectbackend.module.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Dane do przypisania użytkownika do grupy")
public record UserGroupAssignmentDto(
        @NotNull(message = "ID grupy jest wymagane")
        @Schema(description = "ID grupy, do której ma być przypisany użytkownik", example = "5")
        Long groupId
) {
}