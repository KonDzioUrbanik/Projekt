package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.UserCreateDto;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("api/users")
public class UserController {
    UserRepository userRepository;
    UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    public UserResponseDto create(@Valid @RequestBody UserCreateDto dto) {
        return userService.create(dto);
    }

    @GetMapping
    public List<UserResponseDto> all() {
        return userService.findAll();
    }

    @Operation(summary = "Znajdź użytkownika po adresie e-mail")
    @GetMapping(params = "email")
    public UserResponseDto findByEmail(
            @Parameter(description = "Adres e-mail użytkownika", example = "student@pans.pl")
            @RequestParam String email
    ) {
        return userService.findByEmail(email);
    }

    @GetMapping("/me")
    public UserResponseDto me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Brak uwierzytelnienia");
        }
        return userService.findByEmail(auth.getName());
    }
}