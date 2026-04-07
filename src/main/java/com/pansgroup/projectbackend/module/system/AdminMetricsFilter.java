package com.pansgroup.projectbackend.module.system;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class AdminMetricsFilter implements Filter {

    private final AdminSystemHealthService healthService;
    private final AdminSecurityAuditService auditService;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        String path = "unknown";
        String method = "GET";
        String username = null;
        String ip = request.getRemoteAddr();

        if (request instanceof HttpServletRequest httpRequest) {
            path = httpRequest.getRequestURI();
            method = httpRequest.getMethod();
            if (httpRequest.getUserPrincipal() != null) {
                username = httpRequest.getUserPrincipal().getName();
            }
        }

        try {
            chain.doFilter(request, response);
        } finally {
            if (response instanceof HttpServletResponse httpResponse) {
                int status = httpResponse.getStatus();
                healthService.recordRequest(status, path);

                // Rejestracja zdarzeń (tylko poprawne wejścia na strony, brak pollingu/api)
                if (status == 200 && "GET".equalsIgnoreCase(method) && !path.startsWith("/api/")
                        && !path.startsWith("/static/") && !path.contains(".")) {
                    logAccessEvent(path, username, ip);
                }
            }
        }
    }

    private void logAccessEvent(String path, String username, String ip) {
        // ADMIN ACCESS
        if (path.startsWith("/admin")) {
            String details = switch (path) {
                case "/admin/dashboard" -> "Dashboard Administratora";
                case "/admin/system" -> "Monitoring systemu";
                case "/admin/resources" -> "Zarządzanie zasobami";
                case "/admin/security" -> "Centrum bezpieczeństwa";
                case "/admin/users" -> "Zarządzanie użytkownikami";
                case "/admin/announcement" -> "Zarządzanie ogłoszeniami globalnymi";
                case "/admin/post-control" -> "Moderacja postów i forum";
                case "/admin/university-calendar" -> "Konfiguracja kalendarza akademickiego";
                case "/admin/alerts" -> "Zarządzanie alertami systemowymi";
                case "/admin/feedback" -> "Przegląd zgłoszeń (Feedback)";
                case "/admin/schedule", "/admin/schedule-management" -> "Zarządzanie planem zajęć";
                case "/admin/groups-management" -> "Zarządzanie kierunkami studiów";
                case "/admin/analytics" -> "Analityka i statystyki";
                default -> "Dostęp administratora: " + path;
            };
            auditService.recordEvent("ADMIN_ACCESS", ip, details, null, username);
        }
        // STAROSTA ACCESS
        else if (path.startsWith("/starosta")) {
            String details = switch (path) {
                case "/starosta", "/starosta/dashboard" -> "Portal Starosty";
                case "/starosta/announcements" -> "Ogłoszenia dla grupy";
                default -> "Dostęp starosty: " + path;
            };
            auditService.recordEvent("STAROSTA_ACCESS", ip, details, null, username);
        }
        // STUDENT ACCESS
        else if (path.startsWith("/student")) {
            String details = null;
            if (path.equals("/student/dashboard"))
                details = "Pulpit studenta";
            else if (path.equals("/student/calendar"))
                details = "Kalendarz osobisty";
            else if (path.equals("/student/schedule"))
                details = "Plan zajęć";
            else if (path.equals("/student/attendance"))
                details = "Moje obecności";
            else if (path.equals("/student/forum"))
                details = "Forum studentów";
            else if (path.startsWith("/student/chat"))
                details = "Czat wiadomości";
            else if (path.equals("/student/notes"))
                details = "Moje notatki";
            else if (path.equals("/student/announcements"))
                details = "Ogłoszenia grupy";
            else if (path.equals("/student/academic-progress"))
                details = "Postępy w nauce";
            else if (path.equals("/student/university-calendar"))
                details = "Kalendarz akademicki (Public)";

            if (details != null) {
                auditService.recordEvent("USER_ACCESS", ip, details, null, username);
            }
        }
        // SHARED AUTH ACCESS
        else if (path.equals("/profile"))
            auditService.recordEvent("USER_PROFILE", ip, "Mój Profil", null, username);
        else if (path.equals("/settings"))
            auditService.recordEvent("USER_SETTINGS", ip, "Ustawienia konta", null, username);
        else if (path.equals("/change-password"))
            auditService.recordEvent("USER_SECURITY", ip, "Zmiana hasła", null, username);
        else if (path.equals("/home"))
            auditService.recordEvent("USER_ACCESS", ip, "Strona główna portalu", null, username);

        // PUBLIC ACCESS (Auth related)
        else if (username == null) {
            String pubDetails = switch (path) {
                case "/login" -> "Wyświetlenie strony logowania";
                case "/register" -> "Wyświetlenie strony rejestracji";
                case "/forgot-password" -> "Próba odzyskania hasła";
                case "/" -> "Strona startowa (Landing)";
                default -> null;
            };
            if (pubDetails != null) {
                auditService.recordEvent("PUBLIC_ACCESS", ip, pubDetails, null, "Guest");
            }
        }
    }
}
