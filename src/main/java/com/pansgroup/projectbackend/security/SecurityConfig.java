// Kopia Twojego pliku: kondziourbanik/projekt/Projekt-4bcd86d02410d802b2773df99e0aba3be529dcba/src/main/java/com/pansgroup/projectbackend/security/SecurityConfig.java
// Zobacz komentarze, co się zmieniło.

package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.model.User;
import com.pansgroup.projectbackend.service.UserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // (Twoje webSecurityCustomizer() zostaje bez zmian)
    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring().requestMatchers(
                "/static/**",
                "/favcion.png",
                "/favcion.ico",
                "/style.css", // Dodaj tu CSS i JS, aby je ignorować
                "/login.js",
                "/register.js"
        );
    }

    // NOWY BEAN: Musimy powiedzieć Springowi, jak ma ładować użytkownika
    // Użyjemy Twojego istniejącego UserService
// Wróć do SecurityConfig.java i popraw UserDetailsService
    @Bean
    public UserDetailsService userDetailsService(UserService userService) {
        return email -> {
            User user = userService.findUserByEmailInternal(email); // Użyj nowej metody
            if (user == null) {
                throw new UsernameNotFoundException("Nie znaleziono użytkownika: " + email);
            }
            return org.springframework.security.core.userdetails.User
                    .withUsername(user.getEmail())
                    .password(user.getPassword()) // Teraz mamy hasło!
                    .roles(user.getRole().replace("ROLE_", ""))
                    .build();
        };
    }

    // NOWY BEAN: Potrzebny do ręcznego logowania w AuthController
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http.csrf(AbstractHttpConfigurer::disable);
        http.httpBasic(AbstractHttpConfigurer::disable);
        http.formLogin(AbstractHttpConfigurer::disable);

        // USUNIĘTE: Konfiguracja STATELESS. Od teraz używamy sesji.
        // http.sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // USUNIĘTE: Filtr JwtAuthFilter. Już go nie potrzebujemy.
        // http.addFilterBefore(new JwtAuthFilter(secret), UsernamePasswordAuthenticationFilter.class);

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        "/",
                        "/login", // Strona logowania musi być dostępna
                        "/register", // Strona rejestracji musi być dostępna
                        "/tutorial",
                        "/api/auth/**" // API do logowania/rejestracji musi być dostępne
                        // Reszta (style.css, login.js) jest w web.ignoring()
                ).permitAll()
                // CHRONIMY /dashboard
                .requestMatchers(
                        "/dashboard", // Ta strona
                        "/api/users/me" // To API
                ).authenticated() // Wymaga zalogowania (sesji)
                .anyRequest().authenticated() // Cała reszta też
        );

        return http.build();
    }
}