package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.system.AdminSecurityAuditService;
import com.pansgroup.projectbackend.module.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
@Slf4j
@RequiredArgsConstructor
public class LoginAuditListener {

    private final UserService userService;
    private final AdminSecurityAuditService securityAuditService;

    @EventListener
    public void onAuthenticationFailure(AuthenticationFailureBadCredentialsEvent event) {
        String email = event.getAuthentication().getName();
        String ip = getClientIp();

        if (email != null && !email.isEmpty() && !email.equals("anonymousUser")) {
            log.warn("Nieudana próba logowania dla użytkownika: {} z IP: {}.", email, ip);
            userService.incrementFailedAttempts(email);
            securityAuditService.recordEvent("FAILED_LOGIN", ip, "Błędne hasło dla: " + email, null, email);
        }
    }

    @EventListener
    public void onAuthenticationSuccess(AuthenticationSuccessEvent event) {
        String email = event.getAuthentication().getName();
        String ip = getClientIp();
        log.info("Udane logowanie: {} z IP: {}", email, ip);
        securityAuditService.recordEvent("SUCCESSFUL_LOGIN", ip, "Zalogowano: " + email, null, email);
    }

    private String getClientIp() {
        try {
            ServletRequestAttributes attr = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpServletRequest request = attr.getRequest();
            return securityAuditService.extractClientIp(request);
        } catch (Exception e) {
            return "unknown";
        }
    }
}
