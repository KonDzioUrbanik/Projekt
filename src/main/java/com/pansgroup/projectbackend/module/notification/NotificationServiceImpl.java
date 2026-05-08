package com.pansgroup.projectbackend.module.notification;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.notification.dto.NotificationDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import com.pansgroup.projectbackend.module.user.event.UserDeletedEvent;
import org.springframework.context.event.EventListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Objects;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationSettingsService notificationSettingsService;
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void init() {
        try {
            jdbcTemplate.execute("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check");
            log.info("Dropped notifications_type_check constraint if existed");
        } catch (Exception e) {
            log.warn("Could not drop notifications_type_check constraint: {}", e.getMessage());
        }
    }

    @EventListener
    @Transactional
    public void onUserDeleted(UserDeletedEvent event) {
        Long userId = event.getUser().getId();
        notificationRepository.deleteAllByRecipientId(userId);
        log.info("[Notifications] Wiped all notifications for user ID={}", userId);
    }

    @Override
    public void createNotification(User recipient, NotificationType type, String message, String referenceUrl) {
        if (recipient == null) {
            return;
        }

        NotificationSettings settings = notificationSettingsService.getOrCreateSettings(recipient);
        
        boolean shouldNotify = switch (type) {
            case FORUM_COMMENT -> settings.isNotifyForum();
            case SURVEY_NEW -> settings.isNotifySurveys();
            case CHAT_MESSAGE -> settings.isNotifyChat();
            case FRIEND_REQUEST -> settings.isNotifyFriends();
            case ANNOUNCEMENT -> settings.isNotifyAnnouncements();
            default -> true;
        };

        if (!shouldNotify) {
            return;
        }

        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setType(type);
        notification.setMessage(message);
        notification.setReferenceUrl(referenceUrl);
        notification.setRead(false);

        Notification saved = notificationRepository.save(notification);

        NotificationDto dto = mapToDto(saved);

        try {
            messagingTemplate.convertAndSendToUser(recipient.getEmail(), "/queue/notifications", dto);
        } catch (Exception e) {
            log.error("Failed to send websocket notification to user {}", recipient.getEmail(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationDto> getUserNotifications(Pageable pageable) {
        User currentUser = getCurrentUser();
        return notificationRepository.findByRecipient_IdOrderByCreatedAtDesc(currentUser.getId(), pageable)
                .map(this::mapToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount() {
        User currentUser = getCurrentUser();
        return notificationRepository.countByRecipient_IdAndIsReadFalse(currentUser.getId());
    }

    @Override
    public void markAsRead(Long id) {
        User currentUser = getCurrentUser();
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono powiadomienia."));

        if (!Objects.equals(notification.getRecipient().getId(), currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do tego powiadomienia.");
        }

        if (!notification.isRead()) {
            notification.setRead(true);
            notificationRepository.save(notification);
        }
    }

    @Override
    public void markAllAsRead() {
        User currentUser = getCurrentUser();
        notificationRepository.markAllAsReadForUser(currentUser.getId());
    }

    @Override
    public void deleteAllUserNotifications() {
        User currentUser = getCurrentUser();
        notificationRepository.deleteAllByRecipientId(currentUser.getId());
    }

    private NotificationDto mapToDto(Notification notification) {
        return new NotificationDto(
                notification.getId(),
                notification.getType(),
                notification.getMessage(),
                notification.getReferenceUrl(),
                notification.isRead(),
                notification.getCreatedAt()
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
