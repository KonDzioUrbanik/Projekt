package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.ThreadLocalRandom;

@Component
@RequiredArgsConstructor
@Slf4j
public class MarketAdSeeder implements CommandLineRunner {

    private final MarketAdRepository marketAdRepository;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        if (marketAdRepository.count() > 0) {
            log.info("Baza danych ogłoszeń nie jest pusta. Pomijam seedowanie.");
            return;
        }

        User defaultUser = userRepository.findAll().stream()
                .filter(u -> u.getRole().equals("STUDENT") || u.getRole().equals("ROLE_STUDENT"))
                .findFirst()
                .orElse(null);

        if (defaultUser == null) {
            defaultUser = userRepository.findAll().stream().findFirst().orElse(null);
        }

        if (defaultUser == null) {
            log.warn("Brak użytkowników w bazie. Nie można wygenerować testowych ogłoszeń Giełdy.");
            return;
        }

        log.info("Generowanie testowych ogłoszeń giełdy...");

        for (int i = 1; i <= 10; i++) {
            createAd("Przykładowe ogłoszenie nr " + i,
                    "To jest automatycznie wygenerowane ogłoszenie dla celów testowania stronicowania (paginacji). Posiada losową cenę i długi opis testowy. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.",
                    AdCategory.OTHER, AdCondition.USED, new BigDecimal(10 + (Math.random() * 100)), defaultUser);
        }

        createAd("Podręcznik do Anatomii Prawidłowej Tom 1",
                "Książka Bochenka w idealnym stanie, używana tylko przez semestr. Brak zaznaczeń markerem. Odbiór osobisty na Kampusie.",
                AdCategory.BOOKS_NOTES, AdCondition.USED, new BigDecimal("120.00"), defaultUser);

        createAd("Szukam współlokatora/ki - Krosno Centrum",
                "Mam wolny jednoosobowy pokój na ulicy Lwowskiej. Mieszkanie studenckie (3 pokoje). Cena 650 zł ze wszystkimi opłatami. Dostępne od zaraz. Zapraszam do kontaktu w wiadomości prywatnej.",
                AdCategory.HOUSING, AdCondition.NOT_APPLICABLE, new BigDecimal("650.00"), defaultUser);

        createAd("Kalkulator naukowy Casio fx-991CEX",
                "Niezawodny na matematyce dyskretnej i statystyce. Mało używany, przyciski działają idealnie. Dołączam etui.",
                AdCategory.ELECTRONICS, AdCondition.USED, new BigDecimal("75.00"), defaultUser);

        createAd("Korepetycje z Javy / Spring Boota",
                "Pomogę w zrozumieniu programowania obiektowego, struktur danych i przygotuję do kolokwium z Javy. Stawka za 60 minut.",
                AdCategory.TUTORING_HELP, AdCondition.NOT_APPLICABLE, new BigDecimal("45.00"), defaultUser);

        createAd("Oddam notatki z Ekonomii",
                "Zbiór pytań i opracowań z egzaminu z Ekonomii u prof. Nowaka. Oddam za darmo komuś z II roku, nie są mi już potrzebne.",
                AdCategory.GIVEAWAY, AdCondition.USED, null, defaultUser);

        createAd("Znaleziono klucze z brelokiem KPU",
                "Dzisiaj rano (czwartek) pod budynkiem rektoratu znalazłem pęk kluczy. Do odebrania na portierni.",
                AdCategory.LOST_FOUND, AdCondition.NOT_APPLICABLE, null, defaultUser);

        createAd("Nowy Fartuch Laboratoryjny (rozmiar M)",
                "Kupiony zły rozmiar. Fartuch medyczny, 100% bawełna. Nigdy nienoszony, z metką.",
                AdCategory.OTHER, AdCondition.NEW, new BigDecimal("60.00"), defaultUser);

        createAd("Szukam chętnych do zespołu projektowego",
                "Potrzebuję 2 osób do projektu z Aplikacji Internetowych. Ja ogarniam backend (Java), szukam kogoś do frontendu (React) i testów.",
                AdCategory.PROJECT_PARTNER, AdCondition.NOT_APPLICABLE, null, defaultUser);

        log.info("Zakończono generowanie testowych ogłoszeń giełdy (ilość: 30).");
    }

    private void createAd(String title, String description, AdCategory category, AdCondition condition,
            BigDecimal price, User author) {
        MarketAd ad = new MarketAd();
        ad.setTitle(title);
        ad.setDescription(description);
        ad.setCategory(category);
        ad.setCondition(condition);
        ad.setPrice(price);
        ad.setAuthor(author);

        marketAdRepository.save(ad);

        // Generowanie losowej daty od 01.05.2026 do 08.05.2026
        long minDay = LocalDateTime.of(2026, 5, 1, 0, 0).toEpochSecond(ZoneOffset.UTC);
        long maxDay = LocalDateTime.of(2026, 5, 8, 23, 59).toEpochSecond(ZoneOffset.UTC);
        long randomDay = ThreadLocalRandom.current().nextLong(minDay, maxDay);
        LocalDateTime randomDate = LocalDateTime.ofEpochSecond(randomDay, 0, ZoneOffset.UTC);

        // Używamy natywnego update, ponieważ Hibernate domyślnie nadpisuje
        // @CreationTimestamp
        entityManager.flush();
        entityManager.createNativeQuery("UPDATE market_ads SET created_at = :date, updated_at = :date WHERE id = :id")
                .setParameter("date", randomDate)
                .setParameter("id", ad.getId())
                .executeUpdate();
    }
}
