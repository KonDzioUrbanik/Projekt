package com.pansgroup.projectbackend.module.analytics.dto;

import java.util.List;

public record AnalyticsSummaryDto(
        long totalPageViews,
        long totalSessions,
        long totalClicks,
        List<PageStatDto> topPages,
        List<ClickStatDto> topClicks,
        List<DailyStatDto> dailyStats,
        List<UserActivityDto> userActivity
) {}
