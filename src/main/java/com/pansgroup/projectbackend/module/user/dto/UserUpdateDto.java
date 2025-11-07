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

    // nie jest not blank, bo użytkownik nie może zmieniać emaila i index, ale daje tak jakby cos kiedyś trzeba było i wgl
    @Email(message = "{user.email.valid}")
    private String email;

    @Min(value = 1, message = "{user.nrAlbumu.min}")
    @Max(value = 999999, message = "{user.nrAlbumu.max}")
    private Integer nrAlbumu;
}

