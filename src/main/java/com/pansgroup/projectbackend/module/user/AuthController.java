package com.pansgroup.projectbackend.module.user;

import com.pansgroup.projectbackend.module.user.dto.LoginRequestDto;
import com.pansgroup.projectbackend.module.user.dto.UserCreateDto;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import com.pansgroup.projectbackend.module.user.passwordReset.dto.ForgotPasswordRequestDto;
import com.pansgroup.projectbackend.module.user.passwordReset.dto.ResetPasswordRequestDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import static org.springframework.security.web.context.HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserService userService;
    private final AuthenticationManager authManager;

    public AuthController(UserService userService, AuthenticationManager authManager) {
        this.userService = userService;
        this.authManager = authManager;
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponseDto> login(
            @Valid @RequestBody LoginRequestDto dto,
            HttpServletRequest request
    ) {
        // 1) Uwierzytelnienie (tu polecą 401 przy złych danych – obsłuży to globalexceptionhandler)
        Authentication authentication = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(dto.getEmail(), dto.getPassword())
        );

        // 2) Zapis kontekstu do security context oraz do sesji (logowanie stanowe)
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        HttpSession session = request.getSession(true);
        session.setAttribute(SPRING_SECURITY_CONTEXT_KEY, context);

        // 3) Zwróć aktualnego użytkownika na podstawie e-maila z Authentication
        String email = authentication.getName();
        UserResponseDto user = userService.getCurrentUser(email);

        return ResponseEntity.ok(user);
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(@Valid @RequestBody UserCreateDto dto) {
        UserResponseDto saved = userService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // (Opcjonalnie) Zwraca aktualnie zalogowanego użytkownika
    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        UserResponseDto user = userService.getCurrentUser(auth.getName());
        return ResponseEntity.ok(user);
    }

    // (Opcjonalnie) Prosty logout – czyści sesję i kontekst
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequestDto dto
    ) {
        userService.requestPasswordReset(dto.email());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(
            @Valid @RequestBody ResetPasswordRequestDto dto
    ) {
        userService.processPasswordReset(
                dto.token(),
                dto.newPassword(),
                dto.confirmPassword()
        );
        return ResponseEntity.ok().build();
    }
}