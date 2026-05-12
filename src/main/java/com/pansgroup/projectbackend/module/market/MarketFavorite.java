package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "market_favorites", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "ad_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class MarketFavorite {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ad_id", nullable = false)
    private MarketAd ad;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public MarketFavorite(User user, MarketAd ad) {
        this.user = user;
        this.ad = ad;
    }
}
