package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("api/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Operacje związane z użytkownikami")
public class UserController {

    private final UserService userService;

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

    @Operation(summary = "Zaktualizuj profil bieżącego użytkownika")
    @PutMapping("/me")
    public UserResponseDto updateCurrentUser(
            @Valid @RequestBody UserUpdateDto dto,
            Authentication authentication
    ) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userService.findUserByEmailInternal(userDetails.getUsername());
        return userService.updateUser(user.getId(), dto);
    }

    @Operation(summary = "Zmień hasło bieżącego użytkownika")
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody PasswordChangeDto dto,
            Authentication authentication
    ) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userService.findUserByEmailInternal(userDetails.getUsername());
        userService.changePassword(user.getId(), dto);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Pobierz dane bieżącego użytkownika")
    @GetMapping("/me")
    public UserResponseDto getCurrentUser(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        return userService.getCurrentUser(userDetails.getUsername());
    }
}