package com.pansgroup.projectbackend.module.market;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MarketScheduler {
    private final MarketAdService marketAdService;

    /**
     * Uruchamia się codziennie o 2:00 w nocy.
     * Archiwizuje ogłoszenia, których data expiresAt minęła.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void archiveExpiredAds() {
        log.info("[MarketScheduler] Starting periodic ad archiving task...");
        marketAdService.archiveExpiredAds();
    }
}
