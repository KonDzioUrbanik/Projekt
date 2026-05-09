package com.pansgroup.projectbackend.module.market.dto;

public record MarketAdStatsDto(
    long totalActive,
    long myAds,
    long addedToday,
    long categoriesCount,
    long myActiveCount,
    long myAddedToday
) {}
