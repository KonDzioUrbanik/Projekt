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
import org.springframework.data.jpa.domain.Specification;
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
                ServletRequestAttributes attr = (ServletRequestAttributes) RequestContextHolder
                        .currentRequestAttributes();
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
        return request.getRemoteAddr();
    }

    public List<SecurityEvent> getRecentEvents(int limit) {
        return securityEventRepository.findAll(
                PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "timestamp"))).getContent();
    }

    public org.springframework.data.domain.Page<SecurityEvent> getEvents(
            org.springframework.data.domain.Pageable pageable, String eventType, String ipAddress, String query) {
        Specification<SecurityEvent> spec = (root, queryObj, cb) -> cb.conjunction();
        if (eventType != null && !eventType.isEmpty()) {
            spec = spec.and((root, queryObj, cb) -> cb.equal(root.get("eventType"), eventType));
        }
        if (ipAddress != null && !ipAddress.isEmpty()) {
            spec = spec.and((root, queryObj, cb) -> cb.like(root.get("ipAddress"), "%" + ipAddress + "%"));
        }
        if (query != null && !query.isEmpty()) {
            spec = spec.and((root, queryObj, cb) -> cb.or(
                    cb.like(root.get("details"), "%" + query + "%"),
                    cb.like(root.get("email"), "%" + query + "%")));
        }
        org.springframework.data.domain.Pageable p = pageable != null ? pageable
                : org.springframework.data.domain.PageRequest.of(0, 10);
        return securityEventRepository.findAll(spec, p);
    }

    public Map<String, Long> getSuspiciousIPs() {
        LocalDateTime window = LocalDateTime.now().minusHours(24);
        List<String> ips = securityEventRepository.findSuspiciousIPs(window, 5L);

        return ips.stream().collect(Collectors.toMap(ip -> ip, ip -> 6L));
    }

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void cleanupOldLogs() {
        log.info("Rozpoczęto czyszczenie starych logów bezpieczeństwa (starsze niż 30 dni)...");
        securityEventRepository.deleteOlderThan(LocalDateTime.now().minusDays(30));
    }

    @Transactional
    public void deleteEvent(Long id) {
        if (id != null) {
            log.warn("Administrator usuwa pojedynczy wpis bezpieczeństwa ID: {}", id);
            securityEventRepository.deleteById(id);
        }
    }

    @Transactional
    public void clearAllLogs() {
        log.warn("Administrator czyści wszystkie logi bezpieczeństwa!");
        securityEventRepository.deleteAll();
    }
}
