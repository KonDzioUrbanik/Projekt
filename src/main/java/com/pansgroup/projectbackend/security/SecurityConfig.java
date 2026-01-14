
package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
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
            if (!user.isActivated()) {
                throw new DisabledException("Konto nie zostało aktywowane :( Sprawdź e-mail");
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

        // Dzięki temu Spring wie, że jak ktoś nie ma dostępu, to trzeba go rzucić na "/login"
        http.formLogin(form -> form
                .loginPage("/login") // Adres widoku logowania
                .loginProcessingUrl("/login") // Adres POST formularza
                .defaultSuccessUrl("/dashboard", true) // Gdzie przekierować po sukcesie
                .permitAll() // Strona logowania dostępna dla każdego
        );

        http.logout(logout -> logout
            .logoutUrl("/logout")
            .logoutSuccessUrl("/login?logout")
            .permitAll()
        );

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        "/favicon.ico",
                        "/favicon.png",
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
                        "/token-error"
                ).permitAll()

                // API endpoints tylko dla ADMIN
                .requestMatchers(HttpMethod.POST, "/api/schedule/**", "/api/groups").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,
                        "/api/schedule/**",
                        "/api/groups/**",
                        "/api/users/role/update/**",
                        "/api/users/assign-group/**"
                ).hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/schedule/**", "/api/groups/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/groups", "/api/schedule/all").hasRole("ADMIN")
                
                // Widoki admin tylko dla ADMIN
                .requestMatchers("/admin/**").hasRole("ADMIN")

                .requestMatchers(HttpMethod.GET,
                        "/api/schedule",
                        "/api/schedule/{id}",
                        "/api/groups/{id}"
                ).authenticated()

                //to dla api
                .requestMatchers(
                        "/api/users/me",
                        "/api/notes/**"
                ).authenticated()

                //to dla stron widokow
                .requestMatchers(
                    "/dashboard", 
                    "/schedule", //dodalem dla planu zajec
                    "/profile",//dodalem dla edycji profilu
                    "/change-password" //dodalem dla zmiany hasla
                ).authenticated()

                .anyRequest().authenticated()
        );

        return http.build();
    }
}