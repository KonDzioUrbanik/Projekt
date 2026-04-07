package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.system.AdminSecurityAuditService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.LogoutSuccessEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
@Slf4j
@RequiredArgsConstructor
public class LogoutAuditListener {

    private final AdminSecurityAuditService securityAuditService;

    @EventListener
    public void onLogoutSuccess(LogoutSuccessEvent event) {
        String email = event.getAuthentication().getName();
        String ip = getClientIp();
        log.info("Udane wylogowanie: {} z IP: {}", email, ip);
        securityAuditService.recordEvent("LOGOUT", ip, "Wylogowano: " + email, null, email);
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
