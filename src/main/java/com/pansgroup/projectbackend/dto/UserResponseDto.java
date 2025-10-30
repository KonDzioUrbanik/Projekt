package com.pansgroup.projectbackend.dto;

public record UserResponseDto(
        Long id,
        String firstName,
        String lastName,
        String email,
        String role,
        Integer nrAlbumu
) {}
