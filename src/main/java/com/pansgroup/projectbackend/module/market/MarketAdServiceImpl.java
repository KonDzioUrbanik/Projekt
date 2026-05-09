package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.market.dto.MarketAdCreateDto;
import com.pansgroup.projectbackend.module.market.dto.MarketAdResponseDto;
import com.pansgroup.projectbackend.module.market.dto.MarketAdStatsDto;
import com.pansgroup.projectbackend.module.notification.NotificationService;
import com.pansgroup.projectbackend.module.notification.NotificationType;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import com.pansgroup.projectbackend.module.user.event.UserDeletedEvent;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.pansgroup.projectbackend.exception.ResourceNotFoundException;
import com.pansgroup.projectbackend.exception.TooManyRequestsException;
import com.pansgroup.projectbackend.exception.UserNotFoundException;
import org.springframework.security.access.AccessDeniedException;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class MarketAdServiceImpl implements MarketAdService {
    private final MarketAdRepository marketAdRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EntityManager entityManager;

    private static final int MAX_ACTIVE_ADS = 5;
    private static final int MAX_ADS_PER_DAY = 3;

    @Override
    @Transactional(readOnly = true)
    public Page<MarketAdResponseDto> getAllActiveAds(String currentUserEmail, AdCategory category, AdCondition condition, String search, Pageable pageable) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));
        
        String searchParam = (search != null && !search.trim().isEmpty()) 
                ? "%" + search.trim().toLowerCase() + "%" 
                : null;

        return marketAdRepository.findFilteredAds(AdStatus.ACTIVE, category, condition, searchParam, pageable)
                .map(ad -> mapToResponseDto(ad, currentUser));
    }

    @Override
    @Transactional
    public MarketAdResponseDto createAd(MarketAdCreateDto dto, String currentUserEmail) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        // 1. Walidacja Ceny vs Kategoria
        boolean priceOptional = dto.category() == AdCategory.GIVEAWAY || 
                                dto.category() == AdCategory.LOST_FOUND || 
                                dto.category() == AdCategory.PROJECT_PARTNER;
        
        if (!priceOptional && (dto.price() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cena jest wymagana dla wybranej kategorii.");
        }

        // 2. Rate Limiting: Max 3 ogłoszenia na dobę (kalendarzową)
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        long adsToday = marketAdRepository.countByAuthorIdAndCreatedAtAfter(currentUser.getId(), startOfToday);
        if (adsToday >= MAX_ADS_PER_DAY) {
            throw new TooManyRequestsException(
                    "Osiągnięto limit ogłoszeń na dzisiaj (max " + MAX_ADS_PER_DAY + "). Nowy limit dostępny od jutra.");
        }

        long activeAds = marketAdRepository.countByAuthorIdAndStatus(currentUser.getId(), AdStatus.ACTIVE);
        if (activeAds >= MAX_ACTIVE_ADS) {
            throw new TooManyRequestsException("Masz już " + MAX_ACTIVE_ADS
                    + " aktywnych ogłoszeń. Usuń lub zarchiwizuj starsze, aby dodać nowe.");
        }

        String safeTitle = Jsoup.clean(dto.title(), Safelist.none()).trim();
        String safeDescription = Jsoup.clean(dto.description(), Safelist.basic()).trim();

        if (safeTitle.length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tytuł po oczyszczeniu jest zbyt krótki (min. 5 znaków).");
        }
        if (safeDescription.length() < 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Opis po oczyszczeniu jest zbyt krótki (min. 20 znaków).");
        }

        MarketAd ad = new MarketAd();
        ad.setTitle(safeTitle);
        ad.setDescription(safeDescription);
        ad.setPrice(dto.price());
        ad.setCategory(dto.category());
        ad.setCondition(dto.condition());
        ad.setAuthor(currentUser);
        ad.setStatus(AdStatus.ACTIVE);

        MarketAd saved = marketAdRepository.save(ad);
        log.info("[Market] New ad created: ID={}, Title={}, Author={}", saved.getId(), saved.getTitle(),
                currentUserEmail);

        notificationService.createNotification(
                currentUser,
                NotificationType.SYSTEM,
                "Twoje ogłoszenie \"" + saved.getTitle() + "\" zostało pomyślnie opublikowane.",
                "/student/student-market");

        return mapToResponseDto(saved, currentUser);
    }

    @Override
    @Transactional
    public void deleteAd(Long adId, String currentUserEmail) {
        MarketAd ad = marketAdRepository.findById(adId)
                .orElseThrow(() -> new ResourceNotFoundException("Ogłoszenie nie istnieje"));

        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        if (!ad.getAuthor().getId().equals(currentUser.getId()) && !"ADMIN".equalsIgnoreCase(currentUser.getRole())) {
            throw new AccessDeniedException("Brak uprawnień do usunięcia tego ogłoszenia");
        }

        marketAdRepository.delete(ad);
        log.info("[Market] Ad deleted: ID={}, DeletedBy={}", adId, currentUserEmail);
    }

    @Override
    @Transactional
    public void resolveAd(Long adId, String currentUserEmail) {
        MarketAd ad = marketAdRepository.findById(adId)
                .orElseThrow(() -> new ResourceNotFoundException("Ogłoszenie nie istnieje"));

        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        if (!ad.getAuthor().getId().equals(currentUser.getId()) && !"ADMIN".equalsIgnoreCase(currentUser.getRole())) {
            throw new AccessDeniedException("Brak uprawnień do edycji tego ogłoszenia");
        }

        ad.setStatus(AdStatus.RESOLVED);
        marketAdRepository.save(ad);
        log.info("[Market] Ad marked as resolved: ID={}", adId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MarketAdResponseDto> getMyAds(String currentUserEmail, Pageable pageable) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));
        return marketAdRepository.findAllByAuthorIdOrderByCreatedAtDesc(currentUser.getId(), pageable)
                .map(ad -> mapToResponseDto(ad, currentUser));
    }

    @Override
    @Transactional(readOnly = true)
    public MarketAdStatsDto getMarketStats(String currentUserEmail) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        long totalActive = marketAdRepository.countByStatus(AdStatus.ACTIVE);
        long myAds = marketAdRepository.countByAuthorIdAndStatus(currentUser.getId(), AdStatus.ACTIVE);
        long addedToday = marketAdRepository.countAllByCreatedAtAfter(LocalDate.now().atStartOfDay());
        long categoriesCount = marketAdRepository.countDistinctCategoriesByStatus(AdStatus.ACTIVE);
        
        long myActiveCount = myAds;
        long myAddedToday = marketAdRepository.countByAuthorIdAndCreatedAtAfter(currentUser.getId(), 
                LocalDate.now().atStartOfDay());

        return new MarketAdStatsDto(totalActive, myAds, addedToday, categoriesCount, myActiveCount, myAddedToday);
    }

    @Override
    @Transactional
    public void archiveExpiredAds() {
        List<MarketAd> expiredAds = marketAdRepository.findByStatusAndExpiresAtBefore(AdStatus.ACTIVE,
                LocalDateTime.now());

        if (!expiredAds.isEmpty()) {
            for (MarketAd ad : expiredAds) {
                ad.setStatus(AdStatus.ARCHIVED);
                notificationService.createNotification(
                        ad.getAuthor(),
                        NotificationType.SYSTEM,
                        "Twoje ogłoszenie \"" + ad.getTitle() + "\" wygasło i zostało zarchiwizowane.",
                        "/student/student-market");
            }
            marketAdRepository.saveAll(expiredAds);
            log.info("[Market] Auto-archived {} expired ads and sent notifications", expiredAds.size());
        }
    }

    @EventListener
    @Transactional
    public void onUserDeleted(UserDeletedEvent event) {
        Long userId = event.getUser().getId();
        marketAdRepository.deleteAllByAuthorId(userId);
        log.info("[Market] Deleted all ads for removed user ID={}", userId);
    }

    private MarketAdResponseDto mapToResponseDto(MarketAd ad, User currentUser) {
        return new MarketAdResponseDto(
                ad.getId(),
                ad.getTitle(),
                ad.getDescription(),
                ad.getPrice(),
                ad.getCategory(),
                ad.getStatus(),
                ad.getCondition(),
                ad.getAuthor().getId(),
                ad.getAuthor().getFirstName() + " " + ad.getAuthor().getLastName(),
                ad.getCreatedAt(),
                ad.getExpiresAt(),
                currentUser != null && ad.getAuthor().getId().equals(currentUser.getId()));
    }
}
