package com.pansgroup.projectbackend.module.wordle.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WordleGuessDto(
    @NotBlank @Size(min = 5, max = 5) String guess
) {}
