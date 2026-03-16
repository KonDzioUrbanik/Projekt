package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class LoginTrackerListener {

    private final UserService userService;

    @EventListener
    public void onAuthenticationSuccess(AuthenticationSuccessEvent event) {
        Object principal = event.getAuthentication().getPrincipal();
        
        String email = null;
        if (principal instanceof UserDetails) {
            email = ((UserDetails) principal).getUsername();
        } else if (principal instanceof String) {
            email = (String) principal;
        }

        if (email != null) {
            String ip = "unknown";
            try {
                org.springframework.web.context.request.ServletRequestAttributes attributes = 
                    (org.springframework.web.context.request.ServletRequestAttributes) org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
                if (attributes != null) {
                    jakarta.servlet.http.HttpServletRequest request = attributes.getRequest();
                    ip = request.getRemoteAddr();
                    // Obsługa proxy (jeśli dotyczy)
                    String xForwardedFor = request.getHeader("X-Forwarded-For");
                    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                        ip = xForwardedFor.split(",")[0];
                    }
                }
            } catch (Exception e) {
                log.warn("Nie udało się pobrać adresu IP dla użytkownika {}", email);
            }

            log.info("Użytkownik {} zalogował się pomyślnie z IP: {}. Aktualizowanie danych logowania.", email, ip);
            userService.updateLastLogin(email, ip);
        }
    }
}
