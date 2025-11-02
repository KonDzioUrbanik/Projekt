package com.pansgroup.projectbackend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {
    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        // To całkowicie omija łańcuch filtrów Spring Security
        return (web) -> web.ignoring().requestMatchers(
                "/static/**",
                "/favcion.png",
                "/favcion.ico"
                // Dodaj tu inne ścieżki do folderów statycznych, jeśli masz
                // np. "/css/**", "/js/**", "/images/**"
        );
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            @Value("${jwt.secret}") String secret
    ) throws Exception {

        http.csrf(AbstractHttpConfigurer::disable);
        http.httpBasic(AbstractHttpConfigurer::disable);
        http.formLogin(AbstractHttpConfigurer::disable);
        http.sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        http.addFilterBefore(new JwtAuthFilter(secret), UsernamePasswordAuthenticationFilter.class);

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        "/",
                        "/style.css",
                        "/login",
                        "/register",
                        "/tutorial",
                        "/register.js",
                        "/login.js",
                        "/api/auth/**",
                        "/static/favicon.png",
                        "/webjars/**",
                        "/swagger-resources/**",
                        "/favcion.ico",
                        "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**"
                ).permitAll()
                .anyRequest().authenticated()
        );

        return http.build();
    }
}