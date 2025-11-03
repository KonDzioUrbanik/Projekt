// Plik: kondziourbanik/projekt/Projekt-4bcd86d02410d802b2773df99e0aba3be529dcba/src/main/java/com/pansgroup/projectbackend/controller/AuthController.java
package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.dto.LoginRequestDto;
import com.pansgroup.projectbackend.dto.UserCreateDto;
import com.pansgroup.projectbackend.dto.UserResponseDto;
import com.pansgroup.projectbackend.model.User;
import com.pansgroup.projectbackend.service.UserService;
// USUNIĘTE: import JwtService
// USUNIĘTE: import LoginResponseDto
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.springframework.security.web.context.HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// USUNIĘTE: import Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final AuthenticationManager authManager; // NOWY

    public AuthController(UserService userService, AuthenticationManager authManager) { // ZMIENIONY konstruktor
        this.userService = userService;
        this.authManager = authManager; // NOWY
    }

    @PostMapping("/login")
    public UserResponseDto login(
            @RequestBody LoginRequestDto dto,
            HttpServletRequest req
    ) {
        Authentication authentication = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(dto.getEmail(), dto.getPassword())
        );

        SecurityContext sc = SecurityContextHolder.createEmptyContext();
        sc.setAuthentication(authentication);
        SecurityContextHolder.setContext(sc);


        HttpSession session = req.getSession(true);
        session.setAttribute(SPRING_SECURITY_CONTEXT_KEY, sc);

        User user = userService.authenticate(dto);
        return new UserResponseDto(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.getNrAlbumu()
        );

    }

    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(@Valid @RequestBody UserCreateDto dto) {
        UserResponseDto saved = userService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}