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

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring().requestMatchers(
                "/static/**",
                "/favcion.png",
                "/favcion.ico",
                "/style.css",
                "/login.js",
                "/register.js"
        );
    }

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
                        "/",
                        "/login",
                        "/register",
                        "/tutorial",
                        "/api/auth/**"
                ).permitAll()
                .requestMatchers(
                        "/dashboard",
                        "/api/users/me"
                ).authenticated()
                .anyRequest().authenticated()
        );

        return http.build();
    }
}