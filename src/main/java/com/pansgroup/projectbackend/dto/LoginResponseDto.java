package com.pansgroup.projectbackend.dto;

public record LoginResponseDto(String token, UserResponseDto user) {}
