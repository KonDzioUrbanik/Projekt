package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "market_reports")
@Getter
@Setter
@NoArgsConstructor
public class MarketAdReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ad_id", nullable = false)
    private MarketAd ad;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportReason reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    private boolean resolved = false;

    private LocalDateTime resolvedAt;

    public MarketAdReport(MarketAd ad, User reporter, ReportReason reason, String details) {
        this.ad = ad;
        this.reporter = reporter;
        this.reason = reason;
        this.details = details;
    }
}
