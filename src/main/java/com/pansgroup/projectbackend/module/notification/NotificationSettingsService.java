package com.pansgroup.projectbackend.module.notification;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.notification.dto.NotificationSettingsDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationSettingsService {

    private final NotificationSettingsRepository notificationSettingsRepository;
    private final UserRepository userRepository;

    public NotificationSettingsDto getSettings() {
        User user = getCurrentUser();
        NotificationSettings settings = getOrCreateSettings(user);
        return mapToDto(settings);
    }

    public NotificationSettingsDto updateSettings(NotificationSettingsDto dto) {
        User user = getCurrentUser();
        NotificationSettings settings = getOrCreateSettings(user);

        settings.setNotifyForum(dto.notifyForum());
        settings.setNotifySurveys(dto.notifySurveys());
        settings.setNotifyChat(dto.notifyChat());
        settings.setNotifyFriends(dto.notifyFriends());
        settings.setNotifyAnnouncements(dto.notifyAnnouncements());

        settings = notificationSettingsRepository.save(settings);
        return mapToDto(settings);
    }

    public NotificationSettings getOrCreateSettings(User user) {
        return notificationSettingsRepository.findByUser_Id(user.getId())
                .orElseGet(() -> {
                    NotificationSettings newSettings = new NotificationSettings();
                    newSettings.setUser(user);
                    return notificationSettingsRepository.save(newSettings);
                });
    }

    private NotificationSettingsDto mapToDto(NotificationSettings settings) {
        return new NotificationSettingsDto(
                settings.isNotifyForum(),
                settings.isNotifySurveys(),
                settings.isNotifyChat(),
                settings.isNotifyFriends(),
                settings.isNotifyAnnouncements()
        );
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Użytkownik nie jest uwierzytelniony.");
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Użytkownik nie znaleziony: " + email));
    }
}
