package com.pansgroup.projectbackend.module.notification;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "notification_settings")
@Getter
@Setter
public class NotificationSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @JsonIgnore
    private User user;

    @Column(nullable = false)
    private boolean notifyForum = true;

    @Column(nullable = false)
    private boolean notifySurveys = true;

    @Column(nullable = false)
    private boolean notifyChat = true;

    @Column(nullable = false)
    private boolean notifyFriends = true;

    @Column(nullable = false)
    private boolean notifyAnnouncements = true;
}
