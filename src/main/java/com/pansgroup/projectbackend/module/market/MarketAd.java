package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "market_ads", indexes = {
        @Index(name = "idx_market_status", columnList = "status"),
        @Index(name = "idx_market_author", columnList = "author_id")
})
@Getter
@Setter
public class MarketAd {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AdCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AdStatus status = AdStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    private AdCondition condition;

    private BigDecimal price;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime expiresAt;

    @OneToMany(mappedBy = "ad", cascade = CascadeType.ALL, orphanRemoval = true)
    @org.hibernate.annotations.BatchSize(size = 20)
    private java.util.List<MarketAdImage> images = new java.util.ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.updatedAt = LocalDateTime.now();
        // Domyślnie ogłoszenie wygasa po 30 dniach
        if (this.expiresAt == null) {
            this.expiresAt = LocalDateTime.now().plusDays(30);
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
