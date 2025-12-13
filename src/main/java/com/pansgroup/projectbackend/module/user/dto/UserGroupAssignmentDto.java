package com.pansgroup.projectbackend.module.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Dane do przypisania użytkownika do grupy")
public record UserGroupAssignmentDto(
        //@NotNull(message = "ID grupy jest wymagane")
        @Schema(description = "ID grupy, do której ma być przypisany użytkownik. 'Null' aby usunąć przypisanie do grupy.", example = "5")
        Long groupId
) {
}