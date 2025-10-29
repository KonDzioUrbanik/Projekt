package com.pansgroup.projectbackend.dto;

public record UserDto(
        Long id,
        String firstName,
        String lastName,
        String email,
        String role
) {}
