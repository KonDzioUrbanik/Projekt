package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.dto.LoginRequestDto;
import com.pansgroup.projectbackend.dto.LoginResponseDto;
import com.pansgroup.projectbackend.dto.UserCreateDto;
import com.pansgroup.projectbackend.dto.UserResponseDto;
import com.pansgroup.projectbackend.model.User;
import com.pansgroup.projectbackend.service.JwtService;
import com.pansgroup.projectbackend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;

    public AuthController(UserService userService, JwtService jwtService) {
        this.userService = userService;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public LoginResponseDto login(@RequestBody LoginRequestDto dto) {
        User user = userService.authenticate(dto);

        String token = jwtService.generate(
                user.getEmail(),
                Map.of("uid", user.getId(), "role", user.getRole())
        );

        UserResponseDto resp = new UserResponseDto(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.getNrAlbumu()
        );

        return new LoginResponseDto(token, resp);
    }
    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(@Valid @RequestBody UserCreateDto dto) {
        UserResponseDto saved = userService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

}
