package com.pansgroup.projectbackend.security;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wyłącza automatyczną rejestrację RateLimitingFilter w głównym łańcuchu serwletów.
 *
 * Problem: Gdy filtr posiada @Component, Spring Boot automatycznie rejestruje go
 * jako zwykły filtr serwletowy (uruchamiany PRZED Spring Security). Na tym etapie
 * SecurityContextHolder jest PUSTY – filtr nigdy nie zobaczy zalogowanego użytkownika.
 *
 * Rozwiązanie: Wyłączamy tę automatyczną rejestrację tutaj i ręcznie dodajemy filtr
 * do łańcucha Spring Security w SecurityConfig.filterChain(), gdzie SecurityContext
 * jest już wypełniony (użytkownik zidentyfikowany z sesji/ciasteczka).
 */
@Configuration
public class RateLimitingFilterConfig {

    @Bean
    public FilterRegistrationBean<RateLimitingFilter> rateLimitingFilterRegistration(RateLimitingFilter filter) {
        FilterRegistrationBean<RateLimitingFilter> registration = new FilterRegistrationBean<>(filter);
        // Wyłączenie rejestracji w głównym łańcuchu serwletów
        registration.setEnabled(false);
        return registration;
    }
}
