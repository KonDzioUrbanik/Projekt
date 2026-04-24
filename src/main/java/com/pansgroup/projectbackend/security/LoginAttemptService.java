package com.pansgroup.projectbackend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Serwis ochrony przed Brute-Force (Account Locking).
 *
 * Działa niezależnie od rate limitingu IP – haker używający botnetu
 * z tysiącami różnych IP nadal zostanie zablokowany na *konkretnym koncie użytkownika*
 * po X nieudanych próbach logowania.
 *
 * TTL: Po 15 minutach licznik jest resetowany automatycznie przez Caffeine.
 * Maksymalna pojemność cache: 50,000 wpisów (blokada OOM).
 */
@Service
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;

    // Klucz: email użytkownika → wartość: liczba nieudanych prób
    private final Cache<String, AtomicInteger> attemptsCache = Caffeine.newBuilder()
            .expireAfterWrite(15, TimeUnit.MINUTES)
            .maximumSize(50_000)
            .build();

    /** Rejestruje nieudaną próbę logowania dla danego emaila. */
    public void loginFailed(String email) {
        AtomicInteger attempts = attemptsCache.get(email, k -> new AtomicInteger(0));
        if (attempts != null) {
            attempts.incrementAndGet();
        }
    }

    /** Czyści historię prób po udanym logowaniu. */
    public void loginSucceeded(String email) {
        attemptsCache.invalidate(email);
    }

    /** Sprawdza, czy konto zostało zablokowane (przekroczono MAX_ATTEMPTS). */
    public boolean isBlocked(String email) {
        AtomicInteger attempts = attemptsCache.getIfPresent(email);
        return attempts != null && attempts.get() >= MAX_ATTEMPTS;
    }

    /** Zwraca bieżącą liczbę nieudanych prób. */
    public int getAttempts(String email) {
        AtomicInteger attempts = attemptsCache.getIfPresent(email);
        return attempts != null ? attempts.get() : 0;
    }
}
