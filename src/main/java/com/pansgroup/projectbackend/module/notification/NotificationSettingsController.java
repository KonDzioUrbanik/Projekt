package com.pansgroup.projectbackend.module.notification;

import com.pansgroup.projectbackend.module.notification.dto.NotificationSettingsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings/notifications")
@RequiredArgsConstructor
public class NotificationSettingsController {

    private final NotificationSettingsService notificationSettingsService;

    @GetMapping
    public ResponseEntity<NotificationSettingsDto> getSettings() {
        return ResponseEntity.ok(notificationSettingsService.getSettings());
    }

    @PutMapping
    public ResponseEntity<NotificationSettingsDto> updateSettings(@RequestBody NotificationSettingsDto dto) {
        return ResponseEntity.ok(notificationSettingsService.updateSettings(dto));
    }
}
