package com.pansgroup.projectbackend.module.announcement.dto;

public record AttachmentResponseDto(
        Long id,
        String originalFileName,
        String contentType,
        Long fileSize
) {}
