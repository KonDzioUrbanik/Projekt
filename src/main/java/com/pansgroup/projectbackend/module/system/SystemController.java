package com.pansgroup.projectbackend.module.system;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
@Tag(name = "System Management", description = "API for managing system global settings and health")
public class SystemController {

    private final SystemService systemService;
    private final SystemLogCollector logCollector;

    /**
     * Zestaw kluczy które mogą być modyfikowane przez panel admina.
     * Wszystkie inne są odrzucane z HTTP 400, niezależnie od roli.
     */
    private static final Set<String> MUTABLE_KEYS = Set.of(
            "global_maintenance",
            "registration_enabled",
            "login_enabled",
            "module_portal_home",
            "module_student_dashboard",
            "module_notes",
            "module_schedule",
            "module_announcements",
            "module_calendar",
            "module_attendance",
            "module_forum",
            "module_community",
            "module_wordle",
            "module_university_calendar",
            "module_semester_progress",
            "module_starosta_dashboard",
            "module_starosta_announcements",
            "module_starosta_schedule",
            "module_analytics",
            "module_chat",
            "module_group_drive",
            "module_student_market",
            "module_surveys",
            "global_banner_text");

    /**
     * Klucze modułów dostępne publicznie (dla filtra i frontendu).
     * Celowo NIE zawiera global_maintenance, login_enabled ani registration_enabled
     * —
     * ich status nie powinien być ujawniany bez autoryzacji.
     */
    private static final Set<String> PUBLIC_MODULE_KEYS = Set.of(
            "module_portal_home",
            "module_student_dashboard",
            "module_notes",
            "module_schedule",
            "module_announcements",
            "module_calendar",
            "module_attendance",
            "module_forum",
            "module_community",
            "module_wordle",
            "module_university_calendar",
            "module_semester_progress",
            "module_analytics",
            "module_chat",
            "module_group_drive",
            "module_student_market",
            "module_surveys",
            "module_starosta_dashboard",
            "module_starosta_announcements",
            "module_starosta_schedule");

    private static final int BANNER_MAX_LENGTH = 500;

    @GetMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get all system settings")
    public ResponseEntity<List<SystemSetting>> getAllSettings() {
        return ResponseEntity.ok(systemService.getAllSettings());
    }

    @PostMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update a system setting")
    public ResponseEntity<Map<String, String>> updateSetting(@RequestBody Map<String, String> payload) {
        String key = payload.get("key");
        String value = payload.get("value");

        // Odrzuć klucze spoza whitelisty
        if (key == null || !MUTABLE_KEYS.contains(key)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Niedozwolony klucz ustawienia: " + (key == null ? "(null)" : key)));
        }

        if (key.equals("global_banner_text")) {
            // Banner — dopuszczamy dowolny tekst, ale ograniczamy długość
            if (value != null && value.length() > BANNER_MAX_LENGTH) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error",
                                "Treść bannera przekracza dozwolony limit " + BANNER_MAX_LENGTH + " znaków."));
            }
        } else {
            // Wszystkie pozostałe klucze to przełączniki boolean
            if (!"true".equals(value) && !"false".equals(value)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Wartość ustawienia musi być 'true' lub 'false'."));
            }
        }

        // description jest metadaną wewnętrzną — ignorujemy wartość przysłaną z
        // frontendu
        systemService.updateSetting(key, value, null);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/health")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Check system services health")
    public ResponseEntity<Map<String, Boolean>> getHealthStatus() {
        return ResponseEntity.ok(systemService.getHealthStatus());
    }

    /**
     * Publiczne API do sprawdzania statusu modułu — używane przez filtr i frontend.
     * Dostępne TYLKO dla kluczy modułów z PUBLIC_MODULE_KEYS.
     * Dla kluczy spoza whitelisty zwraca 404 (nie 403), żeby nie ujawniać
     * informacji o istnieniu innych kluczy konfiguracyjnych.
     */
    @GetMapping("/module-status/{moduleKey}")
    @Operation(summary = "Check if specific module is enabled")
    public ResponseEntity<Boolean> isModuleEnabled(@PathVariable String moduleKey) {
        if (!PUBLIC_MODULE_KEYS.contains(moduleKey)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(systemService.isModuleEnabled(moduleKey));
    }

    @GetMapping("/logs")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get recent system logs")
    public ResponseEntity<List<SystemLogCollector.LogEntry>> getRecentLogs() {
        return ResponseEntity.ok(logCollector.getRecentLogs());
    }

    @DeleteMapping("/logs")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Clear all recent system logs")
    public ResponseEntity<Void> clearRecentLogs() {
        logCollector.clearLogs();
        return ResponseEntity.ok().build();
    }
}
