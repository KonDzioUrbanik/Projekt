package com.pansgroup.projectbackend.module.system;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class AdminSystemHealthService {

    private final SystemService systemService;
    private LocalDateTime startTime;
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong errorRequests = new AtomicLong(0); // 5xx
    private final AtomicLong clientErrors = new AtomicLong(0); // 4xx
    private final List<String> recent4xxPaths = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
    private final List<String> recent5xxPaths = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AdminSystemHealthService.class);

    @PostConstruct
    public void init() {
        this.startTime = LocalDateTime.now();
    }

    public void recordRequest(int status, String path) {
        totalRequests.incrementAndGet();
        if (status >= 500) {
            errorRequests.incrementAndGet();
            log.error("Błąd serwera (5xx): status {} na ścieżce: {}", status, path);
            if (path != null && !path.isEmpty()) {
                synchronized (recent5xxPaths) {
                    if (!recent5xxPaths.contains(path)) {
                        recent5xxPaths.add(0, path);
                        if (recent5xxPaths.size() > 10) {
                            recent5xxPaths.remove(recent5xxPaths.size() - 1);
                        }
                    }
                }
            }
        } else if (status >= 400) {
            clientErrors.incrementAndGet();
            log.warn("Błąd klienta (4xx): status {} na ścieżce: {}", status, path);
            // Przechowujemy ostatnie 10 unikalnych błędnych ścieżek
            if (path != null && !path.isEmpty()) {
                synchronized (recent4xxPaths) {
                    if (!recent4xxPaths.contains(path)) {
                        recent4xxPaths.add(0, path);
                        if (recent4xxPaths.size() > 10) {
                            recent4xxPaths.remove(recent4xxPaths.size() - 1);
                        }
                    }
                }
            }
        }
    }

    public Map<String, Object> getHealthMetrics() {
        Duration uptime = Duration.between(startTime, LocalDateTime.now());
        Runtime runtime = Runtime.getRuntime();
        
        // Determine backend status based on critical services
        Map<String, Boolean> services = systemService.getHealthStatus();
        
        // Krytycznym serwisem jest Baza Danych. SMTP (mail) może być nieskonfigurowany lokalnie,
        // więc nie powinien rzutować na "AWARIĘ" całego backendu, jeśli system działa.
        boolean isOk = services.getOrDefault("database", false);
        boolean isPartial = isOk && services.containsValue(false); // Np. DB działa, ale SMTP nie
        
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("uptimeSeconds", uptime.getSeconds());
        metrics.put("totalRequests", totalRequests.get());
        metrics.put("errorRequests", errorRequests.get());
        metrics.put("clientErrors", clientErrors.get());
        
        String statusText = isOk ? (isPartial ? "OSTRZEŻENIE" : "SPRAWNY") : "AWARIA";
        metrics.put("status", isOk ? "UP" : "DOWN");
        metrics.put("statusBackend", statusText);
        metrics.put("statusPartial", isPartial);
        metrics.put("statusFrontend", "OK");

        // Nowe: Metryki pamięci (MB)
        metrics.put("memFree", runtime.freeMemory() / 1024 / 1024);
        metrics.put("memTotal", runtime.totalMemory() / 1024 / 1024);
        metrics.put("memMax", runtime.maxMemory() / 1024 / 1024);
        
        metrics.put("recent4xxPaths", recent4xxPaths);
        metrics.put("recent5xxPaths", recent5xxPaths);
        
        return metrics;
    }

    public void resetMetrics() {
        totalRequests.set(0);
        errorRequests.set(0);
        clientErrors.set(0);
        recent4xxPaths.clear();
        recent5xxPaths.clear();
    }
}
