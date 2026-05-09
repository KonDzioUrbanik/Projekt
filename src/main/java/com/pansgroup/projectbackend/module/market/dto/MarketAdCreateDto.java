package com.pansgroup.projectbackend.module.market.dto;

import com.pansgroup.projectbackend.module.market.AdCategory;
import com.pansgroup.projectbackend.module.market.AdCondition;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record MarketAdCreateDto(
        @NotBlank(message = "Tytuł jest wymagany")
        @Size(min = 5, max = 80, message = "Tytuł musi mieć od 5 do 80 znaków")
        String title,

        @NotBlank(message = "Opis jest wymagany")
        @Size(min = 20, max = 2000, message = "Opis musi mieć od 20 do 2000 znaków")
        String description,

        @NotNull(message = "Kategoria jest wymagana")
        AdCategory category,

        @NotNull(message = "Stan przedmiotu jest wymagany")
        AdCondition condition,

        @NotNull(message = "Cena jest wymagana. Wpisz 0 dla ofert bezpłatnych.")
        @DecimalMin(value = "0.0", message = "Cena nie może być ujemna")
        @Digits(integer = 6, fraction = 2, message = "Nieprawidłowy format ceny")
        BigDecimal price
) {
}
