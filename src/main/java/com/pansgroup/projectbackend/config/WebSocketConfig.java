package com.pansgroup.projectbackend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Prefiks dla wiadomości wysyłanych DO serwera (np. /app/chat)
        config.setApplicationDestinationPrefixes("/app");
        
        // Tematy (Topic) na które klienci mogą się zapisywać (Subskrypcja)
        // /topic - wiadomości ogólne (broadcast)
        // /queue - wiadomości prywatne / statusowe
        config.enableSimpleBroker("/topic", "/queue");
        
        // Prefix dla wiadomości kierowanych do konkretnego użytkownika (STOMP User Destination)
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Główny punkt połączenia WebSocket dla systemu (powiadomienia, presence)
        registry.addEndpoint("/ws-system")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Punkt końcowy dla czatu (Native STOMP)
        registry.addEndpoint("/ws/stomp")
                .setAllowedOriginPatterns("*");

        // Punkt końcowy dla czatu (SockJS fallback)
        registry.addEndpoint("/ws/chat")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
