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
    private final MarketFavoriteRepository marketFavoriteRepository;
    private final MarketAdReportRepository marketAdReportRepository;
    private final MarketAdImageRepository marketAdImageRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EntityManager entityManager;
    private final org.apache.tika.Tika tika; // Weryfikacja Magic Bytes (OWASP: Unrestricted File Upload)

    private static final int MAX_ACTIVE_ADS = 5;
    private static final int MAX_ADS_PER_DAY = 3;

    @Override
    @Transactional(readOnly = true)
    public Page<MarketAdResponseDto> getAllActiveAds(String currentUserEmail, AdCategory category,
            AdCondition condition, String search, Pageable pageable) {
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
    public MarketAdResponseDto createAd(MarketAdCreateDto dto, String currentUserEmail,
            org.springframework.web.multipart.MultipartFile[] images) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        // 1. Walidacja Ceny vs Kategoria
        boolean priceOptional = dto.category() == AdCategory.GIVEAWAY ||
                dto.category() == AdCategory.LOST_FOUND ||
                dto.category() == AdCategory.PROJECT_PARTNER;

        if (!priceOptional && (dto.price() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cena jest wymagana dla wybranej kategorii.");
        }

        // 2. Rate Limiting
        LocalDateTime startOfToday = LocalDate.now(java.time.ZoneId.of("Europe/Warsaw")).atStartOfDay();
        long adsToday = marketAdRepository.countByAuthorIdAndCreatedAtAfter(currentUser.getId(), startOfToday);
        if (adsToday >= MAX_ADS_PER_DAY) {
            throw new TooManyRequestsException(
                    "Osiągnięto limit ogłoszeń na dzisiaj (max " + MAX_ADS_PER_DAY
                            + "). Nowy limit dostępny od jutra.");
        }

        long activeAds = marketAdRepository.countByAuthorIdAndStatus(currentUser.getId(), AdStatus.ACTIVE);
        if (activeAds >= MAX_ACTIVE_ADS) {
            throw new TooManyRequestsException("Masz już " + MAX_ACTIVE_ADS
                    + " aktywnych ogłoszeń. Usuń lub zarchiwizuj starsze, aby dodać nowe.");
        }

        String safeTitle = Jsoup.clean(dto.title(), Safelist.none()).trim();
        String safeDescription = Jsoup.clean(dto.description(), Safelist.basic()).trim();

        if (safeTitle.length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Tytuł po oczyszczeniu jest zbyt krótki (min. 5 znaków).");
        }
        if (safeDescription.length() < 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Opis po oczyszczeniu jest zbyt krótki (min. 20 znaków).");
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

        // 3. Obsługa zdjęć (max 3)
        if (images != null && images.length > 0) {
            if (images.length > 3) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Możesz dodać maksymalnie 3 zdjęcia.");
            }

            long totalImagesSize = 0;
            for (org.springframework.web.multipart.MultipartFile file : images) {
                if (file.isEmpty())
                    continue;

                // Bezpieczeństwo: oczyszczenie nazwy pliku (Path Traversal prevention)
                String originalName = org.springframework.util.StringUtils.cleanPath(
                        file.getOriginalFilename() != null ? file.getOriginalFilename() : "image");

                // Jawna blokada rozszerzeń: .jfif, .jpe itp. mają magic bytes JPEG, ale nie są
                // obsługiwanym formatem. Ta kontrola chroni przed bezpośrednimi wywołaniami API (curl/Postman).
                String fileExt = originalName.contains(".")
                        ? originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase()
                        : "";
                if (!java.util.Set.of("jpg", "jpeg", "png", "webp").contains(fileExt)) {
                    log.warn("[Market][Security] Odrzucono plik '{}' - niedozwolone rozszerzenie: {}", originalName, fileExt);
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Rozszerzenie pliku nie jest dozwolone. Użyj .jpg, .jpeg, .png lub .webp.");
                }

                // Walidacja Magic Bytes przez Apache Tika (ignoruje nagłówek Content-Type kontrolowany przez klienta)
                String detectedType;
                try {
                    detectedType = tika.detect(file.getBytes());
                } catch (java.io.IOException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie udało się zweryfikować zawartości pliku.");
                }
                if (!java.util.List.of("image/jpeg", "image/png", "image/webp").contains(detectedType)) {
                    log.warn("[Market][Security] Odrzucono plik '{}' - wykryty typ: {}", originalName, detectedType);
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Zawartość pliku nie odpowiada dozwolonemu formatowi obrazu (JPEG, PNG, WEBP).");
                }

                // Pobierz Content-Type z Tika (nie z nagłówka HTTP - jest wiarygodny)
                String contentType = detectedType;

                // Limit rozmiaru (5MB)
                if (file.getSize() > 5 * 1024 * 1024) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Rozmiar zdjęcia nie może przekraczać 5MB.");
                }

                try {
                    MarketAdImage img = new MarketAdImage(saved, originalName, contentType, file.getSize(),
                            file.getBytes());
                    marketAdImageRepository.save(img);
                    saved.getImages().add(img);
                    totalImagesSize += file.getSize();
                } catch (java.io.IOException e) {
                    log.error("[Market] Error saving image", e);
                }
            }

            // Aktualizacja usedStorage — atomowa operacja z limitem w JPQL
            if (totalImagesSize > 0) {
                int updated = userRepository.incrementUsedStorage(currentUser.getId(), totalImagesSize);
                if (updated == 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Przekroczono limit miejsca na dysku (Storage). Usuń nieużywane pliki i spróbuj ponownie.");
                }
                log.info("[Market] Storage incremented by {} bytes for user {}", totalImagesSize, currentUser.getId());
            }
        }

        log.info("[Market] New ad created: ID={}, Title={}, Images={}", saved.getId(), saved.getTitle(),
                saved.getImages().size());

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
        // Sprawdzamy, czy ogłoszenie w ogóle istnieje
        MarketAd ad = marketAdRepository.findById(adId)
                .orElseThrow(() -> new ResourceNotFoundException("Ogłoszenie nie istnieje"));

        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        if (!ad.getAuthor().getId().equals(currentUser.getId()) && !"ADMIN".equalsIgnoreCase(currentUser.getRole())) {
            throw new AccessDeniedException("Brak uprawnień do usunięcia tego ogłoszenia");
        }

        // 1. Oblicz rozmiar zdjęć przed usunięciem, by zwrócić miejsce właścicielowi
        long imagesSize = marketAdImageRepository.sumFileSizeByAdId(adId);
        Long authorId = ad.getAuthor().getId();

        // 2. Kaskadowe usunięcie powiązań (wymuszone prosto na bazie danych)
        marketFavoriteRepository.deleteAllByAdId(adId);
        marketAdReportRepository.deleteAllByAdId(adId);

        // 3. Bezpieczne usunięcie ogłoszenia po jego ID (zapobiega błędom Detached
        // Entity / State Conflict)
        marketAdRepository.deleteById(adId);

        // 4. Zwrot miejsca na dysku właścicielowi
        if (imagesSize > 0) {
            userRepository.decrementUsedStorage(authorId, imagesSize);
            log.info("[Market] Storage decremented by {} bytes for user {}", imagesSize, authorId);
        }

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
    public Page<MarketAdResponseDto> getMyAds(String currentUserEmail, AdCategory category, AdCondition condition,
            String search, Pageable pageable) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        String searchParam = (search != null && !search.trim().isEmpty())
                ? "%" + search.trim().toLowerCase() + "%"
                : null;

        return marketAdRepository.findMyFilteredAds(currentUser.getId(), category, condition, searchParam, pageable)
                .map(ad -> mapToResponseDto(ad, currentUser));
    }

    @Override
    @Transactional(readOnly = true)
    public MarketAdStatsDto getMarketStats(String currentUserEmail) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        long totalActive = marketAdRepository.countByStatus(AdStatus.ACTIVE);
        long myOffers = marketAdRepository.countByAuthorIdAndStatus(currentUser.getId(), AdStatus.ACTIVE);
        long addedToday = marketAdRepository
                .countAllByCreatedAtAfter(LocalDate.now(java.time.ZoneId.of("Europe/Warsaw")).atStartOfDay());
        long categoriesCount = marketAdRepository.countDistinctCategoriesByStatus(AdStatus.ACTIVE);

        long myActiveCount = myOffers;
        long myAddedToday = marketAdRepository.countByAuthorIdAndCreatedAtAfter(currentUser.getId(),
                LocalDate.now(java.time.ZoneId.of("Europe/Warsaw")).atStartOfDay());

        return new MarketAdStatsDto(totalActive, myOffers, addedToday, categoriesCount, myActiveCount, myAddedToday);
    }

    @Override
    @Transactional
    public void archiveExpiredAds() {
        List<MarketAd> expiredAds = marketAdRepository.findByStatusAndExpiresAtBefore(AdStatus.ACTIVE,
                LocalDateTime.now(java.time.ZoneId.of("Europe/Warsaw")));

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

    @Override
    @Transactional
    public boolean toggleFavorite(Long adId, String currentUserEmail) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        MarketAd ad = marketAdRepository.findById(adId)
                .orElseThrow(() -> new ResourceNotFoundException("Ogłoszenie nie istnieje"));

        var favoriteOpt = marketFavoriteRepository.findByUserAndAd(currentUser, ad);
        if (favoriteOpt.isPresent()) {
            marketFavoriteRepository.delete(favoriteOpt.get());
            log.info("[Market] Ad {} removed from favorites by {}", adId, currentUserEmail);
            return false;
        } else {
            marketFavoriteRepository.save(new MarketFavorite(currentUser, ad));
            log.info("[Market] Ad {} added to favorites by {}", adId, currentUserEmail);
            return true;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MarketAdResponseDto> getFavoriteAds(String currentUserEmail, Pageable pageable) {
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new UserNotFoundException("Użytkownik nie istnieje"));

        return marketFavoriteRepository.findFavoriteAdsByUser(currentUser, pageable)
                .map(fav -> mapToResponseDto(fav.getAd(), currentUser));
    }

    @Override
    @Transactional
    public void reportAd(Long adId, com.pansgroup.projectbackend.module.market.dto.MarketAdReportDto dto,
            String reporterEmail) {
        User reporter = userRepository.findByEmail(reporterEmail)
                .orElseThrow(() -> new UserNotFoundException("Zgłaszający nie istnieje"));

        MarketAd ad = marketAdRepository.findById(adId)
                .orElseThrow(() -> new ResourceNotFoundException("Ogłoszenie nie istnieje"));

        // 1. Nie można zgłosić własnego ogłoszenia
        if (ad.getAuthor().getId().equals(reporter.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie możesz zgłosić własnego ogłoszenia.");
        }

        // 2. Jeden użytkownik może zgłosić dane ogłoszenie tylko raz
        if (marketAdReportRepository.existsByAdIdAndReporterId(adId, reporter.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Już zgłosiłeś to ogłoszenie.");
        }

        // 3. Rate limiting: Max 5 zgłoszeń na dobę na użytkownika
        LocalDateTime startOfToday = LocalDate.now(java.time.ZoneId.of("Europe/Warsaw")).atStartOfDay();
        long reportsToday = marketAdReportRepository.countByReporterIdAndCreatedAtAfter(reporter.getId(), startOfToday);
        if (reportsToday >= 5) {
            throw new TooManyRequestsException("Osiągnięto dzienny limit zgłoszeń (5). Spróbuj ponownie jutro.");
        }

        MarketAdReport report = new MarketAdReport(ad, reporter, dto.reason(),
                dto.details() != null ? Jsoup.clean(dto.details(), Safelist.none()) : null);

        marketAdReportRepository.save(report);
        log.info("[Market] Ad {} reported by {} for reason {}", adId, reporterEmail, dto.reason());

        // 4. Alert dla admina przy dużej liczbie zgłoszeń (np. 3+)
        long activeReports = marketAdReportRepository.countByAdIdAndResolvedFalse(adId);
        if (activeReports >= 3) {
            log.warn("[Market] Ad {} has {} active reports! Investigation recommended.", adId, activeReports);

            // Pobierz dowolnego admina (lub wszystkich) i wyślij powiadomienie
            userRepository.findByRole("ADMIN").stream().findFirst().ifPresent(admin -> {
                notificationService.createNotification(
                        admin,
                        NotificationType.SYSTEM,
                        "Ogłoszenie \"" + ad.getTitle() + "\" otrzymało już " + activeReports
                                + " zgłoszenia! Wymagana weryfikacja.",
                        "/admin/post-control?tab=market");
            });
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<com.pansgroup.projectbackend.module.market.dto.MarketAdReportResponseDto> getAllUnresolvedReports() {
        return marketAdReportRepository.findByResolvedFalseOrderByCreatedAtDesc().stream()
                .map(this::mapToReportResponseDto)
                .toList();
    }

    private com.pansgroup.projectbackend.module.market.dto.MarketAdReportResponseDto mapToReportResponseDto(
            MarketAdReport report) {
        return new com.pansgroup.projectbackend.module.market.dto.MarketAdReportResponseDto(
                report.getId(),
                report.getAd().getId(),
                report.getAd().getTitle(),
                report.getReporter().getFirstName() + " " + report.getReporter().getLastName(),
                report.getReporter().getEmail(),
                report.getReason(),
                report.getDetails(),
                report.getCreatedAt(),
                report.isResolved());
    }

    @Override
    @Transactional
    public void resolveReport(Long reportId) {
        MarketAdReport report = marketAdReportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Zgłoszenie nie istnieje"));
        report.setResolved(true);
        report.setResolvedAt(LocalDateTime.now());
        marketAdReportRepository.save(report);
    }

    @Override
    @Transactional
    public void deleteAdByAdmin(Long adId, Long reportId) {
        // Sprawdzamy, czy ogłoszenie w ogóle istnieje
        MarketAd ad = marketAdRepository.findById(adId)
                .orElseThrow(() -> new ResourceNotFoundException("Ogłoszenie nie istnieje"));

        // 1. Oblicz rozmiar zdjęć przed usunięciem, by zwrócić miejsce właścicielowi
        long imagesSize = marketAdImageRepository.sumFileSizeByAdId(adId);
        Long authorId = ad.getAuthor().getId();

        // 2. Kaskadowe usunięcie powiązań
        marketFavoriteRepository.deleteAllByAdId(adId);
        marketAdReportRepository.deleteAllByAdId(adId);

        // 3. Bezpieczne usunięcie ogłoszenia
        marketAdRepository.deleteById(adId);

        // 4. Zwrot miejsca na dysku właścicielowi
        if (imagesSize > 0) {
            userRepository.decrementUsedStorage(authorId, imagesSize);
            log.info("[Market] Storage decremented by {} bytes for user {} (admin delete)", imagesSize, authorId);
        }

        log.info("[Market] Ad {} deleted by admin due to report {}", adId, reportId);
    }

    @Override
    @Transactional(readOnly = true)
    public MarketAdResponseDto getAdForAdmin(Long adId) {
        MarketAd ad = marketAdRepository.findById(adId)
                .orElseThrow(() -> new ResourceNotFoundException("Ogłoszenie nie istnieje w bazie"));
        return mapToResponseDto(ad, null); // null, bo admina nie obchodzi isOwner/isFavorite
    }

    @EventListener
    @Transactional
    public void onUserDeleted(UserDeletedEvent event) {
        Long userId = event.getUser().getId();

        // 1. Usuń wszystkie "lajki" i zgłoszenia wykonane przez tego użytkownika
        marketFavoriteRepository.deleteAllByUserId(userId);
        marketAdReportRepository.deleteAllByReporterId(userId);

        // 2. Pobierz ogłoszenia użytkownika, aby wyczyścić ich powiązania
        List<MarketAd> userAds = marketAdRepository.findByAuthorId(userId);
        for (MarketAd ad : userAds) {
            marketFavoriteRepository.deleteAllByAdId(ad.getId());
            marketAdReportRepository.deleteAllByAdId(ad.getId());
            marketAdImageRepository.deleteAllByAdId(ad.getId()); // Kaskada zdjęć - @Modifying pomija CascadeType.ALL
        }

        // 3. Teraz można bezpiecznie usunąć ogłoszenia
        marketAdRepository.deleteAllByAuthorId(userId);

        log.info("[Market] Cleaned up all market activities and ads for removed user ID={}", userId);
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
                currentUser != null && ad.getAuthor().getId().equals(currentUser.getId()),
                currentUser != null && marketFavoriteRepository.existsByUserAndAd(currentUser, ad),
                ad.getImages().stream().map(MarketAdImage::getId).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public MarketAdImage getImage(Long imageId) {
        return marketAdImageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Zdjęcie nie istnieje"));
    }
}
