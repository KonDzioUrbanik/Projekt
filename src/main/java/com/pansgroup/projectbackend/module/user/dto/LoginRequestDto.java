package com.pansgroup.projectbackend.module.user.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequestDto {
    private String email;
    private String password;
    private boolean rememberMe;

    public LoginRequestDto() {
    }

    public LoginRequestDto(String email, String password, boolean rememberMe) {
        this.email = email;
        this.password = password;
        this.rememberMe = rememberMe;
    }
}
