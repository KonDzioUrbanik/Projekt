package com.pansgroup.projectbackend.module.notification;

import com.pansgroup.projectbackend.module.notification.dto.NotificationDto;
import com.pansgroup.projectbackend.module.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface NotificationService {

    void createNotification(User recipient, NotificationType type, String message, String referenceUrl);

    Page<NotificationDto> getUserNotifications(Pageable pageable);

    long getUnreadCount();

    void markAsRead(Long id);

    void markAllAsRead();

    void deleteAllUserNotifications();
}
