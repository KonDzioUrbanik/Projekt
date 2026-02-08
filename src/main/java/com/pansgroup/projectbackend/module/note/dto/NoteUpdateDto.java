package com.pansgroup.projectbackend.module.note.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NoteUpdateDto(
                @NotBlank(message = "Tytuł jest wymagany.") @Size(min = 1, max = 150, message = "Tytuł musi mieć od {min} do {max} znaków.") String title,

                @NotBlank(message = "Treść jest wymagana.") String content) {
}
