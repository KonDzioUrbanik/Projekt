package com.pansgroup.projectbackend.module.market.dto;

import com.pansgroup.projectbackend.module.market.ReportReason;
import java.time.LocalDateTime;

public record MarketAdReportResponseDto(
    Long id,
    Long adId,
    String adTitle,
    String reporterName,
    String reporterEmail,
    ReportReason reason,
    String details,
    LocalDateTime createdAt,
    boolean resolved
) {
}
