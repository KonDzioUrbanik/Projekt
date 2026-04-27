package com.pansgroup.projectbackend.module.system;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/security")
@RequiredArgsConstructor
@Slf4j
public class ThreatIntelController {

    private final AdminSecurityAuditService auditService;

    public record ThreatPayload(String type, String details) {}

    @PostMapping("/report-threat")
    public ResponseEntity<Void> reportThreat(@RequestBody ThreatPayload payload, 
                                           Authentication auth, 
                                           HttpServletRequest request) {
        String email = (auth != null && auth.isAuthenticated()) ? auth.getName() : "Anonim";
        String ip = request.getRemoteAddr();
        
        log.warn("Wykryto zagrożenie po stronie klienta: Type={}, Ip={}, User={}, Details={}", 
                payload.type(), ip, email, payload.details());

        // Zapisujemy bezpośrednio do Dziennika Zdarzeń Bezpieczeństwa
        auditService.recordEvent(
            payload.type(), 
            ip, 
            "Client-Side Threat: " + payload.details(), 
            null, 
            email
        );
        
        return ResponseEntity.ok().build();
    }
}
