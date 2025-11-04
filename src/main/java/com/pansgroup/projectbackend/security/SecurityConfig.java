package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring().requestMatchers(
                "/static/**",
                "/favicon.png",
                "/favicon.ico",
                "/css/**",
                "/js/**"
        );
    }

    @Bean
    public UserDetailsService userDetailsService(UserService userService) {
        return email -> {
            User user = userService.findUserByEmailInternal(email);
            if (user == null) {
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

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        // Ścieżki publiczne (bez zmian)
                        "/favicon.ico",
                        "/favicon.png",
                        "/",
                        "/login",
                        "/register",
                        "/tutorial",
                        "/api/auth/**",
                        "/swagger-ui/**",
                        "/v3/api-docs/**"
                ).permitAll()

                // === REGUŁY TYLKO DLA ADMINA ===
                .requestMatchers(HttpMethod.POST, "/api/schedule/**", "/api/groups").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,
                        "/api/schedule/**",
                        "/api/groups/**",
                        "/api/users/role/update/**",
                        "/api/users/assign-group/**"
                ).hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/schedule/**", "/api/groups/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/groups").hasRole("ADMIN")

                // === REGUŁY DLA WSZYSTKICH ZALOGOWANYCH ===
                // 1. Reguły ściśle GET
                .requestMatchers(HttpMethod.GET,
                        "/api/schedule/**",
                        "/api/groups/{id}"
                ).authenticated()

                // 2. Reguły dla ścieżek (każda metoda) i widoków:
                .requestMatchers(
                        "/dashboard",
                        "/api/users/me",
                        "/api/notes/**"
                ).authenticated()

                .anyRequest().authenticated()
        );

        return http.build();
    }
}