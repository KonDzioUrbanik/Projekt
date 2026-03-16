package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class LoginFailureListener {

    private final UserService userService;

    @EventListener
    public void onAuthenticationFailure(AuthenticationFailureBadCredentialsEvent event) {
        String email = event.getAuthentication().getName();
        
        if (email != null && !email.isEmpty() && !email.equals("anonymousUser")) {
            log.warn("Nieudana próba logowania dla użytkownika: {}. Inkrementacja licznika.", email);
            userService.incrementFailedAttempts(email);
        }
    }
}
