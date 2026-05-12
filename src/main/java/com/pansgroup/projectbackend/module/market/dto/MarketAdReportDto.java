package com.pansgroup.projectbackend.module.market.dto;

import com.pansgroup.projectbackend.module.market.ReportReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MarketAdReportDto(
    @NotNull(message = "Powód zgłoszenia jest wymagany")
    ReportReason reason,

    @Size(max = 500, message = "Szczegóły nie mogą przekraczać 500 znaków")
    String details
) {
}
