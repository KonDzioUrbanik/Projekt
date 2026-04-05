package com.pansgroup.projectbackend.module.chat.dto;

public record UserSearchResultDto(
        Long id,
        String fullName,
        String fieldOfStudy,
        Integer yearOfStudy,
        String role
) {}
