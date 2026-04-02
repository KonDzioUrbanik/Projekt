package com.pansgroup.projectbackend.module.system;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.annotation.PostConstruct;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SystemService {

    private final SystemSettingRepository repository;
    private final JdbcTemplate jdbcTemplate;
    private final JavaMailSender mailSender;

    private final java.util.Map<String, String> settingsCache = new java.util.concurrent.ConcurrentHashMap<>();

    @PostConstruct
    public void initSettings() {
        createSettingIfAbsent("global_maintenance", "false", "Globalny tryb konserwacji - blokuje dostęp wszystkim poza adminami");
        createSettingIfAbsent("registration_enabled", "true", "Zezwalaj na rejestrację nowych użytkowników");
        createSettingIfAbsent("login_enabled", "true", "Zezwalaj na logowanie do platformy");
        createSettingIfAbsent("module_notes", "true", "Status modułu Notatki");
        createSettingIfAbsent("module_schedule", "true", "Status modułu Harmonogram zajęć");
        createSettingIfAbsent("module_announcements", "true", "Status modułu Ogłoszenia grupy");
        createSettingIfAbsent("module_calendar", "true", "Status modułu Kalendarz");
        createSettingIfAbsent("module_attendance", "true", "Status modułu Obecności");
        createSettingIfAbsent("module_forum", "true", "Status modułu Forum");
        createSettingIfAbsent("module_university_calendar", "true", "Status modułu Kalendarz akademicki");
        createSettingIfAbsent("module_semester_progress", "true", "Status modułu Postęp semestru");
        createSettingIfAbsent("module_starosta_announcements", "true", "Status modułu Wyślij ogłoszenie (Starosta)");
        createSettingIfAbsent("global_banner_text", "", "Treść komunikatu wyświetlanego wszystkim użytkownikom");
        
        // Populate cache
        repository.findAll().forEach(s -> settingsCache.put(s.getSettingKey(), s.getSettingValue()));
    }

    private void createSettingIfAbsent(String key, String defaultValue, String description) {
        if (repository.findBySettingKey(key).isEmpty()) {
            repository.save(SystemSetting.builder()
                    .settingKey(key)
                    .settingValue(defaultValue)
                    .description(description)
                    .build());
        }
    }

    // Cache dla ułatwienia (opcjonalnie, tu na razie bez cache dla pewności DB)

    @Transactional(readOnly = true)
    public String getSetting(String key, String defaultValue) {
        return settingsCache.getOrDefault(key, 
            repository.findBySettingKey(key)
                .map(s -> {
                    settingsCache.put(key, s.getSettingValue());
                    return s.getSettingValue();
                })
                .orElse(defaultValue)
        );
    }

    @Transactional
    public void updateSetting(String key, String value, String description) {
        SystemSetting setting = repository.findBySettingKey(key)
                .orElse(SystemSetting.builder().settingKey(key).build());

        setting.setSettingValue(value);
        if (description != null) {
            setting.setDescription(description);
        }
        repository.save(setting);
        settingsCache.put(key, value);
    }

    public boolean isModuleEnabled(String moduleKey) {
        // Klucze np. "module_notes", "module_schedule", "global_maintenance"
        String val = getSetting(moduleKey, "true"); // Domyślnie włączone
        return "true".equalsIgnoreCase(val);
    }

    public Map<String, Boolean> getHealthStatus() {
        Map<String, Boolean> status = new HashMap<>();

        // Database check
        try {
            jdbcTemplate.execute("SELECT 1");
            status.put("database", true);
        } catch (Exception e) {
            log.error("Database health check failed", e);
            status.put("database", false);
        }

        // SMTP check
        try {
            if (mailSender instanceof JavaMailSenderImpl jms) {
                jms.testConnection();
                status.put("smtp", true);
            } else {
                status.put("smtp", false);
            }
        } catch (Exception e) {
            log.error("SMTP health check failed", e);
            status.put("smtp", false);
        }

        return status;
    }

    @Transactional(readOnly = true)
    public List<SystemSetting> getAllSettings() {
        return repository.findAll();
    }
}
