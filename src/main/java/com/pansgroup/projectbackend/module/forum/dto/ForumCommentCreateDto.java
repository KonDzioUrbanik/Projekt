package com.pansgroup.projectbackend.module.forum.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ForumCommentCreateDto(
        @NotBlank(message = "Tresc komentarza jest wymagana.")
        @Size(max = 2000, message = "Komentarz nie moze miec wiecej niz {max} znakow.")
        String content
) {
}

