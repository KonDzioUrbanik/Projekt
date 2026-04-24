package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import com.pansgroup.projectbackend.module.system.SystemService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.RememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.security.config.Customizer;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

/* Główna konfiguracja Spring Security */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

        @Bean
        public UserDetailsService userDetailsService(UserService userService, SystemService systemService,
                        LoginAttemptService loginAttemptService) {
                return email -> {
                        // Ochrona Brute-Force: konto zablokowane po 5 nieudanych próbach (TTL 15 min)
                        if (loginAttemptService.isBlocked(email)) {
                                throw new DisabledException(
                                                "Konto zostało tymczasowo zablokowane z powodu zbyt wielu błędnych prób logowania. Odczekaj 15 minut.");
                        }
                        User user = userService.findUserByEmailInternal(email);
                        if (user == null) {
                                throw new UsernameNotFoundException("Nie znaleziono użytkownika: " + email);
                        }

                        // Blokada logowania dla użytkowników
                        if (!systemService.isModuleEnabled("login_enabled")
                                        && !"ADMIN".equalsIgnoreCase(user.getRole())) {
                                throw new DisabledException(
                                                "Logowanie jest obecnie wyłączone ze względu na prace konserwacyjne. Przepraszamy za niedogodności.");
                        }

                        if (user.isBlocked()) {
                                throw new DisabledException(
                                                "Twoje konto zostało zablokowane przez administratora. Skontaktuj się z obsługą.");
                        }
                        if (!user.isActivated()) {
                                throw new DisabledException(
                                                "Konto nie zostało aktywowane. Sprawdź swoją skrzynkę e-mail i kliknij w link aktywacyjny. Jeśli nie otrzymałeś wiadomości, skontaktuj się z administratorem.");
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

        @org.springframework.beans.factory.annotation.Value("${app.security.remember-me.key}")
        private String rememberMeKey;

        @org.springframework.beans.factory.annotation.Value("${app.maintenance.bypass-token:}")
        private String maintenanceBypassToken;

        @Bean
        public PersistentTokenRepository persistentTokenRepository(
                        @org.springframework.lang.NonNull javax.sql.DataSource dataSource) {
                org.springframework.security.web.authentication.rememberme.JdbcTokenRepositoryImpl tokenRepository = new org.springframework.security.web.authentication.rememberme.JdbcTokenRepositoryImpl();
                if (dataSource != null) {
                        tokenRepository.setDataSource(dataSource);
                }
                return tokenRepository;
        }

        @Bean
        public RememberMeServices rememberMeServices(UserDetailsService userDetailsService,
                        PersistentTokenRepository tokenRepository) {
                // Używamy własnej klasy, aby obsłużyć flagę przekazaną w atrybucie (dla
                // logowania JSON)
                CustomRememberMeServices services = new CustomRememberMeServices(
                                rememberMeKey, userDetailsService, tokenRepository);
                services.setTokenValiditySeconds(604800); // 7 dni
                services.setParameter("remember-me");
                return services;
        }

        /**
         * Własna implementacja, która zagląda również do atrybutów żądania.
         * Dzięki temu AuthController może ustawić flagę ręcznie dla żądań JSON.
         */
        public static class CustomRememberMeServices extends PersistentTokenBasedRememberMeServices {
                public CustomRememberMeServices(String key, UserDetailsService userDetailsService,
                                PersistentTokenRepository tokenRepository) {
                        super(key, userDetailsService, tokenRepository);
                }

                @Override
                protected boolean rememberMeRequested(jakarta.servlet.http.HttpServletRequest request,
                                String parameter) {
                        Object flag = request.getAttribute("REMEMBER_ME_FLAG");
                        if (flag instanceof Boolean) {
                                return (Boolean) flag;
                        }
                        return super.rememberMeRequested(request, parameter);
                }
        }

        @Bean
        public SystemMaintenanceFilter systemMaintenanceFilter(SystemService systemService) {
                SystemMaintenanceFilter filter = new SystemMaintenanceFilter(systemService);
                filter.setBypassToken(maintenanceBypassToken);
                return filter;
        }

        /* CORS – Cross-Origin Resource Sharing */
        @Bean
        public CorsConfigurationSource corsConfigurationSource(
                        @Value("${app.cors.allowed-origins:http://localhost:8090,http://localhost:3000}") String originsRaw) {

                CorsConfiguration cfg = new CorsConfiguration();
                cfg.setAllowedOrigins(List.of(originsRaw.split(",")));
                cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Captcha-Token", "X-Requested-With"));
                cfg.setAllowCredentials(true); // Wymagane dla ciasteczek sesji
                cfg.setMaxAge(3600L); // Cache preflight na 1 godzinę

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", cfg);
                return source;
        }

        @Bean
        public SecurityFilterChain filterChain(HttpSecurity http,
                        RememberMeServices rememberMeServices,
                        AccountStatusFilter accountStatusFilter,
                        SystemMaintenanceFilter systemMaintenanceFilter,
                        RateLimitingFilter rateLimitingFilter)
                        throws Exception {

                // CSRF WYŁĄCZONE
                http.csrf(AbstractHttpConfigurer::disable);
                http.httpBasic(AbstractHttpConfigurer::disable);
                // CORS włączony z Beanem CorsConfigurationSource
                http.cors(Customizer.withDefaults());

                // Rejestracja filtra sprawdzającego status konta (blokady) oraz tryb
                // konserwacji
                http.addFilterBefore(systemMaintenanceFilter, AuthorizationFilter.class);
                http.addFilterBefore(accountStatusFilter, AuthorizationFilter.class);

                // Rate Limiting WEWNĄTRZ Łańcucha Spring Security
                http.addFilterBefore(rateLimitingFilter, AuthorizationFilter.class);

                // Dzięki temu Spring wie, że jak ktoś nie ma dostępu, to trzeba go rzucić na
                // "/login"
                http.formLogin(form -> form
                                .loginPage("/login") // Adres widoku logowania
                                .loginProcessingUrl("/login") // Adres POST formularza
                                .defaultSuccessUrl("/home", true) // Gdzie przekierować po sukcesie
                                .permitAll() // Strona logowania dostępna dla każdego
                );

                http.logout(logout -> logout
                                .logoutUrl("/logout")
                                .logoutSuccessUrl("/login?logout")
                                .permitAll());

                http.authorizeHttpRequests(auth -> auth
                                .requestMatchers(
                                                "/",
                                                "/login",
                                                "/register",
                                                "/tutorial",
                                                "/api/auth/**",
                                                "/confirm",
                                                "/reset-password",
                                                "/forgot-password",
                                                "/password-reset-expired",
                                                "/token-error",
                                                "/contact",
                                                "/error/**",
                                                "/maintenance",
                                                "/module-maintenance",
                                                "/api/system/module-status/**",
                                                "/static/**",
                                                "/css/**",
                                                "/js/**",
                                                "/images/**",
                                                "/favicon.ico",
                                                "/favicon.png")
                                .permitAll()

                                // API feedback dla niezalogowanych
                                .requestMatchers(HttpMethod.POST, "/api/feedback").permitAll()

                                // API endpoints tylko dla ADMIN/STAROSTY (Harmonogram, Grupy)
                                .requestMatchers(HttpMethod.POST, "/api/schedule/**", "/api/groups", "/api/groups/")
                                .hasAnyRole("ADMIN", "STAROSTA")

                                // Globalne zarzadzanie uzytkownikami tylko dla ADMINA
                                .requestMatchers(HttpMethod.POST, "/api/users", "/api/users/")
                                .hasRole("ADMIN")
                                .requestMatchers(HttpMethod.PUT,
                                                "/api/schedule/**",
                                                "/api/groups/**")
                                .hasAnyRole("ADMIN", "STAROSTA")

                                // Krytyczne zarzadzanie kontami (tylko ADMIN)
                                .requestMatchers(HttpMethod.PUT,
                                                "/api/users/role/update/**",
                                                "/api/users/assign-group/**",
                                                "/api/users/assignGroup/**",
                                                "/api/users/activation/**",
                                                "/api/users/block/**")
                                .hasRole("ADMIN")
                                .requestMatchers(HttpMethod.DELETE, "/api/schedule/**")
                                .hasAnyRole("ADMIN", "STAROSTA")
                                .requestMatchers(HttpMethod.DELETE, "/api/groups/**",
                                                "/api/users/**")
                                .hasRole("ADMIN")
                                .requestMatchers(HttpMethod.GET,
                                                "/api/groups", "/api/groups/",
                                                "/api/schedule/all", "/api/schedule/all/")
                                .hasAnyRole("ADMIN", "STAROSTA")

                                .requestMatchers(HttpMethod.GET, "/api/users", "/api/users/")
                                .hasRole("ADMIN")
                                .requestMatchers(HttpMethod.GET, "/api/users/search")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")

                                // API ogłoszeń
                                .requestMatchers(HttpMethod.POST, "/api/announcements").hasAnyRole("STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.GET, "/api/announcements/all").hasRole("ADMIN")
                                .requestMatchers(HttpMethod.GET, "/api/announcements/group")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.POST, "/api/announcements/*/confirm-read")
                                .hasAnyRole("STUDENT", "STAROSTA")
                                .requestMatchers(HttpMethod.DELETE, "/api/announcements/*")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                // Nowe endpointy v1.4.0
                                .requestMatchers(HttpMethod.GET, "/api/announcements/*/read-details")
                                .hasAnyRole("STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.PATCH, "/api/announcements/*/pin")
                                .hasAnyRole("STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.GET, "/api/announcements/attachments/**",
                                                "/api/announcements/count/author/**")
                                .authenticated()

                                // API forum
                                .requestMatchers(HttpMethod.GET, "/api/forum/**")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.POST, "/api/forum/threads")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.POST, "/api/forum/threads/*/comments")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.POST, "/api/forum/threads/*/like")
                                .hasAnyRole("STUDENT", "STAROSTA")
                                .requestMatchers(HttpMethod.PUT, "/api/forum/threads/*")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.PUT, "/api/forum/threads/*/comments/*")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.DELETE, "/api/forum/threads/*/comments/*")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.DELETE, "/api/forum/threads/*")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                // System Management, Widoki Admin i Dokumentacja API
                                .requestMatchers("/api/system/module-status/**").permitAll()
                                .requestMatchers("/admin/**", "/api/admin/**", "/api/system/**", "/swagger-ui/**",
                                                "/v3/api-docs/**")
                                .hasRole("ADMIN")

                                 // Feedback (studenci mogą tworzyć, ADMIN zarządza)
                                 .requestMatchers(HttpMethod.POST, "/api/feedback").authenticated()
                                 .requestMatchers("/api/feedback", "/api/feedback/**").hasRole("ADMIN")

                                 // Ustawienia Roku, Błędy Telemetrii, Zarzadzanie Uzytkownikami na globalnym poziomie
                                 .requestMatchers(HttpMethod.GET, "/api/academic-year/current").authenticated()
                                 .requestMatchers("/api/academic-year", "/api/academic-year/**",
                                                 "/api/preferences/errors/**")
                                 .hasRole("ADMIN")

                                // Kalendarz i Ankiety (Zarządzanie - POST, PUT, PATCH, DELETE)
                                .requestMatchers(HttpMethod.POST, "/api/surveys", "/api/surveys/**", "/api/calendar",
                                                "/api/calendar/**")
                                .hasAnyRole("ADMIN", "STAROSTA")
                                .requestMatchers(HttpMethod.PUT, "/api/surveys/**", "/api/calendar/**")
                                .hasAnyRole("ADMIN", "STAROSTA")
                                .requestMatchers(HttpMethod.PATCH, "/api/surveys/**").hasAnyRole("ADMIN", "STAROSTA")
                                .requestMatchers(HttpMethod.DELETE, "/api/surveys/**", "/api/calendar/**")
                                .hasAnyRole("ADMIN", "STAROSTA")

                                // Widoki starosty tylko dla STAROSTA
                                .requestMatchers("/starosta/**").hasRole("STAROSTA")

                                .requestMatchers(HttpMethod.GET,
                                                "/api/schedule",
                                                "/api/schedule/{id}",
                                                "/api/groups/{id}")
                                .authenticated()

                                // to dla api
                                .requestMatchers(
                                                "/api/users/me",
                                                "/api/notes/**")
                                .authenticated()

                                // to dla stron widokow
                                .requestMatchers("/home").authenticated()
                                .requestMatchers(
                                                "/student/**", // cała strefa studenta
                                                "/profile", // edycja profilu
                                                "/settings" // formularz ustawien
                                ).hasAnyRole("STUDENT", "STAROSTA", "ADMIN")

                                // Czat — tylko niezablokowani STUDENT/STAROSTA
                                .requestMatchers("/student/chat/**").hasAnyRole("STUDENT", "STAROSTA")
                                .requestMatchers("/api/chat/**").hasAnyRole("STUDENT", "STAROSTA")

                                .anyRequest().authenticated());

                http.rememberMe(rememberMe -> rememberMe
                                .rememberMeServices(rememberMeServices));

                // Nagłówki bezpieczeństwa HTTP
                http.headers(headers -> headers
                                // Content-Security-Policy
                                // 'unsafe-inline' w script-src jest wymagane przez inline ANTI-FOUC skrypt w
                                // <head>
                                // Jeśli w przyszłości inline skrypt zostanie zastąpiony nonce/hash, można
                                // usunąć 'unsafe-inline'
                                .contentSecurityPolicy(csp -> csp.policyDirectives(
                                                "default-src 'self'; " +
                                                                "script-src 'self' 'unsafe-inline' " +
                                                                "https://cdn.quilljs.com " +
                                                                "https://cdn.jsdelivr.net " +
                                                                "https://cdnjs.cloudflare.com; " +
                                                                "style-src 'self' 'unsafe-inline' " +
                                                                "https://fonts.googleapis.com " +
                                                                "https://cdnjs.cloudflare.com " +
                                                                "https://cdn.quilljs.com " +
                                                                "https://cdn.jsdelivr.net; " +
                                                                "font-src 'self' data: " +
                                                                "https://fonts.gstatic.com " +
                                                                "https://cdnjs.cloudflare.com; " +
                                                                "img-src 'self' data: blob: https://ui-avatars.com; " +
                                                                "connect-src 'self' ws: wss: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
                                                                +
                                                                "frame-ancestors 'none'; " +
                                                                "base-uri 'self'; " +
                                                                "form-action 'self'"))
                                .frameOptions(frame -> frame.deny())
                                .contentTypeOptions(Customizer.withDefaults())
                                .referrerPolicy(referrer -> referrer
                                                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)));

                return http.build();
        }
}