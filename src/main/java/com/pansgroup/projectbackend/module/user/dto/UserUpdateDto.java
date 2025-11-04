package com.pansgroup.projectbackend.module.user.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserUpdateDto {

    @NotBlank(message = "{user.firstName.notBlank}")
    private String firstName;

    @NotBlank(message = "{user.lastName.notBlank}")
    private String lastName;

    // nie jest NotBlank, bo użytkownik nie moze zmieniać emaila i indexu, ale daje tak jakby cos kiedys trzeba bylo i wgl
    @Email(message = "{user.email.valid}")
    private String email;

    @Min(value = 1, message = "{user.nrAlbumu.min}")
    @Max(value = 999999, message = "{user.nrAlbumu.max}")
    private Integer nrAlbumu;
}

