package com.pansgroup.projectbackend.module.forum.dto;

public record AttachmentResponseDto(
        Long id,
        String originalFileName,
        String contentType,
        Long fileSize
) {
}

