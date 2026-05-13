package com.pansgroup.projectbackend.module.market;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "market_ad_images")
@Getter
@Setter
@NoArgsConstructor
public class MarketAdImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ad_id", nullable = false)
    private MarketAd ad;

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false)
    private String contentType;

    private Long fileSize;

    @Lob
    @Column(name = "image_data", nullable = false)
    private byte[] imageData;

    public MarketAdImage(MarketAd ad, String fileName, String contentType, Long fileSize, byte[] imageData) {
        this.ad = ad;
        this.fileName = fileName;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.imageData = imageData;
    }
}
