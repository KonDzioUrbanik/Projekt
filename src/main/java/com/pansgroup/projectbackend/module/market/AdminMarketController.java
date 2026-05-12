package com.pansgroup.projectbackend.module.market;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/market")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMarketController {
    private final MarketAdService marketAdService;

    @GetMapping("/reports")
    public ResponseEntity<List<com.pansgroup.projectbackend.module.market.dto.MarketAdReportResponseDto>> getUnresolvedReports() {
        return ResponseEntity.ok(marketAdService.getAllUnresolvedReports());
    }

    @GetMapping("/ads/{id}")
    public ResponseEntity<com.pansgroup.projectbackend.module.market.dto.MarketAdResponseDto> getAdDetailsForAdmin(@PathVariable Long id) {
        return ResponseEntity.ok(marketAdService.getAdForAdmin(id));
    }

    @PostMapping("/reports/{id}/resolve")
    public ResponseEntity<Void> resolveReport(@PathVariable Long id) {
        marketAdService.resolveReport(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/reports/{reportId}/ads/{adId}")
    public ResponseEntity<Void> deleteAdAndResolveReport(
            @PathVariable Long reportId,
            @PathVariable Long adId) {
        marketAdService.deleteAdByAdmin(adId, reportId);
        return ResponseEntity.ok().build();
    }
}
