package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import com.pansgroup.projectbackend.module.system.SystemService;
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

@Configuration
public class SecurityConfig {

        @Bean
        public UserDetailsService userDetailsService(UserService userService, SystemService systemService) {
                return email -> {
                        User user = userService.findUserByEmailInternal(email);
                        if (user == null) {
                                throw new UsernameNotFoundException("Nie znaleziono użytkownika: " + email);
                        }

                        // Blokada logowania dla użytkowników (nie dotyczy ADMIN)
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

        @Bean
        public SecurityFilterChain filterChain(HttpSecurity http,
                        RememberMeServices rememberMeServices,
                        AccountStatusFilter accountStatusFilter,
                        SystemMaintenanceFilter systemMaintenanceFilter)
                        throws Exception {

                http.csrf(AbstractHttpConfigurer::disable);
                http.httpBasic(AbstractHttpConfigurer::disable);

                // Rejestracja filtra sprawdzającego status konta (blokady) oraz tryb
                // konserwacji
                http.addFilterBefore(systemMaintenanceFilter, AuthorizationFilter.class);
                http.addFilterBefore(accountStatusFilter, AuthorizationFilter.class);

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
                                                "/swagger-ui/**",
                                                "/v3/api-docs/**",
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

                                // API endpoints tylko dla ADMIN
                                .requestMatchers(HttpMethod.POST, "/api/schedule/**", "/api/groups")
                                .hasAnyRole("ADMIN", "STAROSTA")
                                .requestMatchers(HttpMethod.PUT,
                                                "/api/schedule/**",
                                                "/api/groups/**",
                                                "/api/users/role/update/**",
                                                "/api/users/assign-group/**",
                                                "/api/users/assignGroup/**",
                                                "/api/users/activation/**",
                                                "/api/users/block/**")
                                .hasAnyRole("ADMIN", "STAROSTA")
                                .requestMatchers(HttpMethod.DELETE, "/api/schedule/**")
                                .hasAnyRole("ADMIN", "STAROSTA")
                                .requestMatchers(HttpMethod.DELETE, "/api/groups/**",
                                                "/api/users/**")
                                .hasRole("ADMIN")
                                .requestMatchers(HttpMethod.GET,
                                                "/api/groups",
                                                "/api/schedule/all",
                                                "/api/users")
                                .hasAnyRole("ADMIN", "STAROSTA")
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
                                .requestMatchers(HttpMethod.GET, "/api/announcements/attachments/**", "/api/announcements/count/author/**")
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
                                .requestMatchers(HttpMethod.PATCH, "/api/forum/threads/*/moderation")
                                .hasRole("ADMIN")

                                // API ankiet i glosowan
                                .requestMatchers(HttpMethod.GET, "/api/surveys/*/results").permitAll()
                                .requestMatchers(HttpMethod.GET, "/api/surveys/**")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.POST, "/api/surveys")
                                .hasAnyRole("STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.POST, "/api/surveys/*/vote")
                                .hasAnyRole("STUDENT", "STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.PATCH, "/api/surveys/*/status")
                                .hasAnyRole("STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.PATCH, "/api/surveys/*/extend")
                                .hasAnyRole("STAROSTA", "ADMIN")
                                .requestMatchers(HttpMethod.DELETE, "/api/surveys/*")
                                .hasAnyRole("STAROSTA", "ADMIN")

                                // Widoki admin tylko dla ADMIN
                                .requestMatchers("/admin/**").hasRole("ADMIN")

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
                                                                "img-src 'self' data: blob:; " +
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