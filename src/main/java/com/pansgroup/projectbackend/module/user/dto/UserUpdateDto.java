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

    private String nickName;
    private String phoneNumber;
    private String fieldOfStudy;
    private String yearOfStudy;
    private String studyMode;
    private String bio;
}

