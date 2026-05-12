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

    @PostMapping("/offers")
    public ResponseEntity<MarketAdResponseDto> createAd(
            @Valid @RequestBody MarketAdCreateDto dto,
            Principal principal) {
        return ResponseEntity.ok(marketAdService.createAd(dto, principal.getName()));
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
}
