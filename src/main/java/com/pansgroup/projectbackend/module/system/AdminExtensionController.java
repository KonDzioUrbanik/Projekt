package com.pansgroup.projectbackend.module.system;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @GetMapping("/resources/refresh")
    @Operation(summary = "Manually refresh the storage stats cache")
    public ResponseEntity<Void> refreshResources() {
        resourcesService.refreshStats();
        return ResponseEntity.ok().build();
    }

    @org.springframework.web.bind.annotation.PostMapping("/resources/sync-quotas")
    @Operation(summary = "Perform a full quota sync (Audit & Fix used_storage columns)")
    public ResponseEntity<Map<String, String>> syncQuotas() {
        resourcesService.performFullQuotaSync();
        return ResponseEntity.ok(Map.of("message", "Synchronizacja kwot została ukończona."));
    }

    @GetMapping("/resources/debug")
    @Operation(summary = "Get debug info for storage columns (bytea sizes)")
    public ResponseEntity<List<Map<String, Object>>> getDebugInfo() {
        return ResponseEntity.ok(resourcesService.getStorageDebugInfo());
    }

    @GetMapping("/security/events")
    @Operation(summary = "Get paginated security audit logs with filtering")
    public ResponseEntity<org.springframework.data.domain.Page<SecurityEvent>> getRecentEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String ipAddress,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "timestamp,desc") String sort) {

        String[] sortParts = sort.split(",");
        String sortField = sortParts[0];
        org.springframework.data.domain.Sort.Direction sortDir = (sortParts.length > 1
                && sortParts[1].equalsIgnoreCase("asc"))
                        ? org.springframework.data.domain.Sort.Direction.ASC
                        : org.springframework.data.domain.Sort.Direction.DESC;

        return ResponseEntity.ok(securityAuditService.getEvents(
                org.springframework.data.domain.PageRequest.of(page, size,
                        org.springframework.data.domain.Sort.by(sortDir, sortField)),
                eventType,
                ipAddress,
                query));
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

    @DeleteMapping("/security/events/{id}")
    @Operation(summary = "Delete a single security audit log entry")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        securityAuditService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/health/live")
    @Operation(summary = "Get live system health and performance metrics")
    public ResponseEntity<Map<String, Object>> getLiveHealth() {
        return ResponseEntity.ok(healthService.getHealthMetrics());
    }
}