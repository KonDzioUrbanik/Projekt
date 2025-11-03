package com.pansgroup.projectbackend.module.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Dane użytkownika zwracane w odpowiedzi")
public record UserResponseDto(
        @Schema(description = "ID użytkownika", example = "1")
        Long id,

        @Schema(description = "Imię użytkownika", example = "Konrad")
        String firstName,

        @Schema(description = "Nazwisko użytkownika", example = "Urbanik")
        String lastName,

        @Schema(description = "Adres e-mail użytkownika", example = "konrad@pans.pl")
        String email,

        @Schema(description = "Rola użytkownika", example = "ROLE_USER")
        String role,

        @Schema(description = "Numer albumu studenta", example = "12345")
        Integer nrAlbumu
) {}
