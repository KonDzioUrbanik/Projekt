package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
// Poprawiony import - ten jest potrzebny
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        // ---- POPRAWKA ----
        // Tutaj zostawiamy TYLKO zasoby statyczne (CSS, JS, obrazki).
        // Usunięto stąd "/api/**" i ścieżki swaggera.
        return (web) -> web.ignoring().requestMatchers(
                "/static/**",
                "/favcion.png",
                "/favcion.ico",
                "/css/**", // Dodano dla pewności
                "/js/**"  // Dodano dla pewności
        );
    }

    @Bean
    public UserDetailsService userDetailsService(UserService userService) {
        return email -> {
            // Używamy poprawionego wyjątku ze Spring Security
            User user = userService.findUserByEmailInternal(email);
            if (user == null) {
                // Ten wyjątek jest poprawnie obsługiwany przez Spring Security
                throw new UsernameNotFoundException("Nie znaleziono użytkownika: " + email);
            }
            return org.springframework.security.core.userdetails.User
                    .withUsername(user.getEmail())
                    .password(user.getPassword())
                    .roles(user.getRole().replace("ROLE_", ""))
                    .build();
        };
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http.csrf(AbstractHttpConfigurer::disable);
        http.httpBasic(AbstractHttpConfigurer::disable);
        http.formLogin(AbstractHttpConfigurer::disable);

        // ---- POPRAWKA ----
        // Tutaj definiujemy, co jest publiczne, a co wymaga logowania.
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        // Ścieżki publiczne (strona, logowanie, rejestracja)
                        "/",
                        "/login",
                        "/register",
                        "/tutorial",
                        // API do logowania i rejestracji
                        "/api/auth/**",

                        // Ścieżki wymagane do działania Swaggera
                        "/swagger-ui/**",
                        "/v3/api-docs/**"
                ).permitAll()
                .requestMatchers(
                        // Ścieżki wymagające zalogowania
                        "/dashboard",
                        "/api/users/me",
                        "/api/notes/**" // Przykładowe zabezpieczenie reszty API
                ).authenticated()

                // Cała reszta API (jeśli coś zostało) też powinna być chroniona
                .anyRequest().authenticated()
        );

        return http.build();
    }
}