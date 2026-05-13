package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.market.dto.MarketAdCreateDto;
import com.pansgroup.projectbackend.module.market.dto.MarketAdResponseDto;
import com.pansgroup.projectbackend.module.market.dto.MarketAdStatsDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
public class MarketAdController {
    private final MarketAdService marketAdService;

    @GetMapping("/offers")
    public ResponseEntity<Page<MarketAdResponseDto>> getActiveAds(
            @RequestParam(required = false) AdCategory category,
            @RequestParam(required = false) AdCondition condition,
            @RequestParam(required = false) String search,
            Pageable pageable, Principal principal) {
        return ResponseEntity.ok(marketAdService.getAllActiveAds(principal.getName(), category, condition, search, pageable));
    }

    @PostMapping(value = "/offers", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MarketAdResponseDto> createAd(
            @RequestPart("ad") @Valid MarketAdCreateDto dto,
            @RequestPart(value = "images", required = false) org.springframework.web.multipart.MultipartFile[] images,
            Principal principal) {
        return ResponseEntity.ok(marketAdService.createAd(dto, principal.getName(), images));
    }

    @GetMapping("/images/{imageId}")
    public ResponseEntity<byte[]> getImage(@PathVariable Long imageId) {
        MarketAdImage image = marketAdService.getImage(imageId);
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.maxAge(30, java.util.concurrent.TimeUnit.DAYS).cachePublic())
                .contentType(org.springframework.http.MediaType.parseMediaType(image.getContentType()))
                .body(image.getImageData());
    }

    @DeleteMapping("/offers/{id}")
    public ResponseEntity<Void> deleteAd(@PathVariable Long id, Principal principal) {
        marketAdService.deleteAd(id, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/offers/{id}/resolve")
    public ResponseEntity<Void> resolveAd(@PathVariable Long id, Principal principal) {
        marketAdService.resolveAd(id, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my-offers")
    public ResponseEntity<Page<MarketAdResponseDto>> getMyAds(
            @RequestParam(required = false) AdCategory category,
            @RequestParam(required = false) AdCondition condition,
            @RequestParam(required = false) String search,
            Pageable pageable, Principal principal) {
        return ResponseEntity.ok(marketAdService.getMyAds(principal.getName(), category, condition, search, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<MarketAdStatsDto> getStats(Principal principal) {
        return ResponseEntity.ok(marketAdService.getMarketStats(principal.getName()));
    }

    @PostMapping("/favorites/{id}")
    public ResponseEntity<Boolean> toggleFavorite(@PathVariable Long id, Principal principal) {
        return ResponseEntity.ok(marketAdService.toggleFavorite(id, principal.getName()));
    }

    @GetMapping("/favorites")
    public ResponseEntity<Page<MarketAdResponseDto>> getFavorites(Pageable pageable, Principal principal) {
        return ResponseEntity.ok(marketAdService.getFavoriteAds(principal.getName(), pageable));
    }

    @PostMapping("/offers/{id}/report")
    public ResponseEntity<Void> reportAd(
            @PathVariable Long id,
            @Valid @RequestBody com.pansgroup.projectbackend.module.market.dto.MarketAdReportDto dto,
            Principal principal) {
        marketAdService.reportAd(id, dto, principal.getName());
        return ResponseEntity.ok().build();
    }
}
