package com.pansgroup.projectbackend.module.system;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminSecurityAuditService {

    private final SecurityEventRepository securityEventRepository;

    @Async
    public void recordEvent(String type, String ip, String details, Long userId, String email) {
        SecurityEvent event = new SecurityEvent();
        event.setEventType(type);
        
        if (ip == null) {
            try {
                ServletRequestAttributes attr = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
                HttpServletRequest request = attr.getRequest();
                event.setIpAddress(extractClientIp(request));
            } catch (Exception e) {
                event.setIpAddress("unknown");
            }
        } else {
            event.setIpAddress(ip);
        }
        event.setDetails(details);
        event.setUserId(userId);
        event.setEmail(email);
        securityEventRepository.save(event);
        log.info("Zdarzenie bezpieczeństwa [Logged]: {} od {}", type, event.getIpAddress());
    }

    public String extractClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf == null || xf.isEmpty() || "unknown".equalsIgnoreCase(xf)) {
            return request.getRemoteAddr();
        }
        // Może zawierać listę IP (pierwszy to klient)
        return xf.split(",")[0].trim();
    }

    public List<SecurityEvent> getRecentEvents(int limit) {
        return securityEventRepository.findAll(
            PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "timestamp"))
        ).getContent();
    }

    public Map<String, Long> getSuspiciousIPs() {
        // Poprawka wydajnościowa: Agregacja SQL zamiast pobierania całej tabeli
        LocalDateTime window = LocalDateTime.now().minusHours(24);
        List<String> ips = securityEventRepository.findSuspiciousIPs(window, 5L);
        
        // Zwracamy mapę z licznikiem (uproszczone do 6 jako "powyżej progu")
        return ips.stream().collect(Collectors.toMap(ip -> ip, ip -> 6L)); 
    }

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void cleanupOldLogs() {
        log.info("Rozpoczęto czyszczenie starych logów bezpieczeństwa (starsze niż 30 dni)...");
        securityEventRepository.deleteOlderThan(LocalDateTime.now().minusDays(30));
    }

    @Transactional
    public void clearAllLogs() {
        log.warn("Administrator czyści wszystkie logi bezpieczeństwa!");
        securityEventRepository.deleteAll();
    }
}
