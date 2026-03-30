package com.pansgroup.projectbackend.module.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

@Schema(description = "Dane użytkownika zwracane w odpowiedzi")
public record UserResponseDto(
        @Schema(description = "ID użytkownika", example = "1") Long id,

        @Schema(description = "Imię użytkownika", example = "Konrad") String firstName,

        @Schema(description = "Nazwisko użytkownika", example = "Urbanik") String lastName,

        @Schema(description = "Adres e-mail użytkownika", example = "konrad@pans.pl") String email,

        @Schema(description = "Rola użytkownika", example = "ROLE_USER") String role,

        @Schema(description = "Numer albumu studenta", example = "12345") Integer nrAlbumu,

        // NOWE POLA
        @Schema(description = "ID grupy studenta", example = "1") Long groupId,

        @Schema(description = "Nazwa grupy studenta", example = "Informatyka 2A") String groupName,

        @Schema(description = "Czy konto aktywowane? (zweryfikowany email)", example = "No") boolean isActivated,
        @Schema(description = "Czy konto zablokowane przez administratora?", example = "false") boolean isBlocked,

        String nickName,
        String phoneNumber,
        String fieldOfStudy,
        Integer yearOfStudy,
        String studyMode,
        String bio,
        LocalDateTime lastLogin,
        LocalDateTime createdAt,
        String lastLoginIp,
        Integer failedLoginAttempts,
        LocalDateTime previousLogin) {
}