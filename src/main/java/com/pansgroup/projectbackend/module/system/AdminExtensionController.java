package com.pansgroup.projectbackend.module.system;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Extensions", description = "Expanded admin monitoring (Resources, Security, Health)")
public class AdminExtensionController {

    private final AdminSystemResourcesService resourcesService;
    private final AdminSecurityAuditService securityAuditService;
    private final AdminSystemHealthService healthService;

    @GetMapping("/resources/stats")
    @Operation(summary = "Get current storage and DB resource stats")
    public ResponseEntity<SystemResourceStats> getResourceStats() {
        return ResponseEntity.ok(resourcesService.getCurrentStats());
    }

    @GetMapping("/resources/history")
    @Operation(summary = "Get storage usage history for charts")
    public ResponseEntity<List<SystemResourceStats>> getResourceHistory() {
        return ResponseEntity.ok(resourcesService.getHistory());
    }

    @GetMapping("/resources/breakdown")
    @Operation(summary = "Get detailed storage breakdown (avatars, attachments, logs)")
    public ResponseEntity<Map<String, Object>> getStorageBreakdown() {
        return ResponseEntity.ok(resourcesService.getStorageBreakdown());
    }

    @GetMapping("/resources/top-users")
    @Operation(summary = "Get TOP 10 users by storage usage")
    public ResponseEntity<List<Map<String, Object>>> getTopUsers() {
        return ResponseEntity.ok(resourcesService.getTopUsersByStorage());
    }

    @GetMapping("/security/events")
    @Operation(summary = "Get recent security audit logs")
    public ResponseEntity<List<SecurityEvent>> getRecentEvents() {
        return ResponseEntity.ok(securityAuditService.getRecentEvents(50));
    }

    @GetMapping("/security/suspicious")
    @Operation(summary = "Get patterns and suspicious activities")
    public ResponseEntity<Map<String, Long>> getSuspiciousIPs() {
        return ResponseEntity.ok(securityAuditService.getSuspiciousIPs());
    }

    @DeleteMapping("/security/events")
    @Operation(summary = "Clear all security audit logs")
    public ResponseEntity<Void> clearAllLogs() {
        securityAuditService.clearAllLogs();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/health/live")
    @Operation(summary = "Get live system health and performance metrics")
    public ResponseEntity<Map<String, Object>> getLiveHealth() {
        return ResponseEntity.ok(healthService.getHealthMetrics());
    }
}
