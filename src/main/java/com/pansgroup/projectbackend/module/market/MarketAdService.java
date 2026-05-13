package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.market.dto.MarketAdCreateDto;
import com.pansgroup.projectbackend.module.market.dto.MarketAdResponseDto;
import com.pansgroup.projectbackend.module.market.dto.MarketAdStatsDto;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;

public interface MarketAdService {
    Page<MarketAdResponseDto> getAllActiveAds(String currentUserEmail, AdCategory category, AdCondition condition, String search, Pageable pageable);
    MarketAdResponseDto createAd(MarketAdCreateDto dto, String currentUserEmail, org.springframework.web.multipart.MultipartFile[] images);
    void deleteAd(Long adId, String currentUserEmail);
    void resolveAd(Long adId, String currentUserEmail);
    Page<MarketAdResponseDto> getMyAds(String currentUserEmail, AdCategory category, AdCondition condition, String search, Pageable pageable);
    MarketAdStatsDto getMarketStats(String currentUserEmail);
    void archiveExpiredAds();
    boolean toggleFavorite(Long adId, String currentUserEmail);
    Page<MarketAdResponseDto> getFavoriteAds(String currentUserEmail, Pageable pageable);
    void reportAd(Long adId, com.pansgroup.projectbackend.module.market.dto.MarketAdReportDto dto, String reporterEmail);
    List<com.pansgroup.projectbackend.module.market.dto.MarketAdReportResponseDto> getAllUnresolvedReports();
    void resolveReport(Long reportId);
    void deleteAdByAdmin(Long adId, Long reportId);
    MarketAdResponseDto getAdForAdmin(Long adId);
    MarketAdImage getImage(Long imageId);
}
