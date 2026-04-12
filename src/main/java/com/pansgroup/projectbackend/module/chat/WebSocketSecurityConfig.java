package com.pansgroup.projectbackend.module.chat;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.web.socket.EnableWebSocketSecurity;
import org.springframework.security.messaging.access.intercept.MessageMatcherDelegatingAuthorizationManager;

/**
 * Spring Security 6 WebSocket security configuration.
 *
 * WITHOUT this class, Spring Security 6 does not properly propagate the
 * authenticated principal to STOMP sessions.  That means:
 *  - SimpUserRegistry can't find a session for a given email
 *  - convertAndSendToUser(email, ...) silently delivers to nobody
 *  - Real-time chat is completely broken
 *
 * @EnableWebSocketSecurity enables proper CSRF handling (disabled for WS here)
 * and wires the SecurityContextHolder into each incoming STOMP message.
 */
@Configuration
@EnableWebSocketSecurity
public class WebSocketSecurityConfig {

    /**
     * Allow all authenticated STOMP messages.
     * The HTTP-layer authentication (session cookie) already guarantees the user
     * is logged in; no per-message auth needed.
     */
    @Bean
    AuthorizationManager<Message<?>> messageAuthorizationManager(
            MessageMatcherDelegatingAuthorizationManager.Builder messages) {
        messages.anyMessage().authenticated();
        return messages.build();
    }

    /**
     * Disable CSRF protection for WebSockets.
     * Since CSRF is disabled globally in SecurityConfig, the STOMP connection 
     * will fail immediately because CsrfChannelInterceptor expects a token. 
     * Overriding this bean with a no-op disables the check.
     */
    @Bean(name = "csrfChannelInterceptor")
    org.springframework.messaging.support.ChannelInterceptor csrfChannelInterceptor() {
        return new org.springframework.messaging.support.ChannelInterceptor() {
        };
    }
}
