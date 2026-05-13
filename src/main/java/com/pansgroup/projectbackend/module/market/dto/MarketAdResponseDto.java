package com.pansgroup.projectbackend.module.market.dto;

import com.pansgroup.projectbackend.module.market.AdCategory;
import com.pansgroup.projectbackend.module.market.AdCondition;
import com.pansgroup.projectbackend.module.market.AdStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MarketAdResponseDto(
        Long id,
        String title,
        String description,
        BigDecimal price,
        AdCategory category,
        AdStatus status,
        AdCondition condition,
        Long authorId,
        String authorName,
        String authorEmail,
        LocalDateTime createdAt,
        LocalDateTime expiresAt,
        boolean isOwner,
        boolean isFavorite,
        java.util.List<Long> imageIds
) {
}
