package com.pansgroup.projectbackend.module.system;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "system_resource_stats")
@Getter
@Setter
public class SystemResourceStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    private Long totalDbSize;          // Physical (Infrastructure)
    private Long totalLogicalSize;     // sum of user uploads
    private Long avatarLogicalSize;    // Logical size for avatars
    private Long attachmentLogicalSize; // Logical size for attachments
    private Long totalLogSize;
    
    private Long totalFileCount;
    private Long avatarCount;
    private Long attachmentCount;

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
}
