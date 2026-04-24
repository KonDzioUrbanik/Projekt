package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.system.AdminSecurityAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.stereotype.Component;

/**
 * Komponent nasłuchujący zdarzeń uwierzytelniania Spring Security.
 * Wydzielony z SecurityConfig, aby poprawnie obsługiwać wstrzykiwanie zależności.
 */
@Component
@RequiredArgsConstructor
public class AuthenticationEventsListener {

    private final LoginAttemptService loginAttemptService;
    private final AdminSecurityAuditService auditService;

    @EventListener
    public void onAuthFailure(AuthenticationFailureBadCredentialsEvent event) {
        String username = event.getAuthentication().getName();
        
        // 1. Zwiększ licznik błędnych logowań (ochrona Brute-Force)
        loginAttemptService.loginFailed(username);
        
        // 2. Zapisz zdarzenie w logach bezpieczeństwa
        auditService.recordEvent("LOGIN_FAILED", null, "Nieudana próba logowania dla: " + username, null, username);
    }

    @EventListener
    public void onAuthSuccess(AuthenticationSuccessEvent event) {
        String username = event.getAuthentication().getName();
        
        // 1. Reset licznika po udanym logowaniu
        loginAttemptService.loginSucceeded(username);
        
        // 2. Zapisz pomyślne logowanie
        auditService.recordEvent("LOGIN_SUCCESS", null, "Pomyślne logowanie użytkownika: " + username, null, username);
    }
}
