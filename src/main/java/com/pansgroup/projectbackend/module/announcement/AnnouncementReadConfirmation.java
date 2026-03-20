package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "announcement_read_confirmations",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_announcement_reader", columnNames = {"announcement_id", "reader_id"})
        }
)
@Getter
@Setter
public class AnnouncementReadConfirmation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "announcement_id", nullable = false)
    private Announcement announcement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reader_id", nullable = false)
    private User reader;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime confirmedAt;
}
