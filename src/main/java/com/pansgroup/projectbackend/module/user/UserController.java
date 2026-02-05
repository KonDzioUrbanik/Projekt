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

import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

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
            @Parameter(description = "Adres e-mail użytkownika", example = "student@pans.pl") @RequestParam String email) {
        return userService.findByEmail(email);
    }

    @Operation(summary = "Zaktualizuj profil bieżącego użytkownika")
    @PutMapping("/me")
    public UserResponseDto updateCurrentUser(
            @Valid @RequestBody UserUpdateDto dto,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userService.findUserByEmailInternal(userDetails.getUsername());
        return userService.updateUser(user.getId(), dto);
    }

    @Operation(summary = "Zmień hasło bieżącego użytkownika")
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody PasswordChangeDto dto,
            Authentication authentication) {
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

    @Operation(summary = "Zmiana roli użytkownika")
    @PutMapping("/role/update/{email}")
    public UserResponseDto updateRoleUser(@PathVariable String email, @Valid @RequestBody UserRoleUpdateDto dto) {
        return userService.updateRoleUser(email, dto);
    }

    @Operation(summary = "Przypisanie użytkownika do kierunku (Tylko Admin)")
    @PutMapping("/assignGroup/{email}")
    public UserResponseDto assignUserToGroup(
            @PathVariable String email,
            @Valid @RequestBody UserGroupAssignmentDto dto) {
        return userService.assignUserToGroup(email, dto);
    }

    @Operation(summary = "Usuń użytkownika (Tylko Admin)")
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        userService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Prześlij awatar użytkownika")
    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> uploadAvatar(@RequestParam("file") MultipartFile file, Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userService.findUserByEmailInternal(userDetails.getUsername());
        userService.uploadAvatar(user.getId(), file);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Pobierz awatar użytkownika")
    @GetMapping("/{id}/avatar")
    public ResponseEntity<Resource> getAvatar(@PathVariable Long id) {
        User user = userService.getAvatar(id);
        String contentType = user.getAvatarContentType();
        if (contentType == null) {
            contentType = "application/octet-stream";
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"avatar\"")
                .body(new ByteArrayResource(user.getAvatarData()));
    }

    @Operation(summary = "Usuń awatar użytkownika")
    @DeleteMapping("/me/avatar")
    public ResponseEntity<Void> removeAvatar(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userService.findUserByEmailInternal(userDetails.getUsername());
        userService.removeAvatar(user.getId());
        return ResponseEntity.noContent().build();
    }

}
