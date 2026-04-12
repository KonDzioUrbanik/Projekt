package com.pansgroup.projectbackend.module.chat;

import com.pansgroup.projectbackend.module.chat.dto.MessageDto;
import com.pansgroup.projectbackend.module.chat.dto.WsMessagePayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Handles WebSocket (STOMP) events for the chat module.
 * All destinations prefixed with "/app" (→ @MessageMapping).
 * Delivery to user-specific queues: /user/{principal}/queue/...
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Client sends: /app/chat.send
     * Server delivers to both participants: /user/{id}/queue/messages
     */
    @MessageMapping("/chat.send")
    public void send(@Payload WsMessagePayload payload, Authentication auth) {
        try {
            MessageDto msg = chatService.sendMessage(auth, payload.conversationId(), payload.content());

            String recipientPrincipal = chatService.getRecipientEmail(auth, msg.conversationId());

            messagingTemplate.convertAndSendToUser(auth.getName(), "/queue/messages", msg);

            if (recipientPrincipal != null && !recipientPrincipal.equals(auth.getName())) {
                MessageDto recipientMsg = new MessageDto(
                        msg.id(), msg.conversationId(), msg.senderId(), msg.senderName(),
                        msg.content(), msg.sentAt(), msg.editedAt(), msg.deletedAt(),
                        msg.status(), false);
                messagingTemplate.convertAndSendToUser(recipientPrincipal, "/queue/messages", recipientMsg);
            }
        } catch (Exception e) {
            log.warn("WS send failed for user {}: {}", auth.getName(), e.getMessage());
            messagingTemplate.convertAndSendToUser(auth.getName(), "/queue/errors",
                    Map.of("error", e.getMessage()));
        }
    }

    /**
     * Typing indicator: /app/chat.typing
     * Payload: {conversationId, typing: true/false}
     */
    private final java.util.Map<String, Long> typingRateMap = new java.util.concurrent.ConcurrentHashMap<>();

    @MessageMapping("/chat.typing")
    public void typing(@Payload Map<String, Object> payload, Authentication auth) {
        String senderName = auth.getName();
        long now = System.currentTimeMillis();
        long lastMs = typingRateMap.getOrDefault(senderName, 0L);
        if (now - lastMs < 500) {
            return; // drop spam
        }
        typingRateMap.put(senderName, now);

        try {
            Long convId = Long.valueOf(payload.get("conversationId").toString());
            boolean isTyping = Boolean.parseBoolean(payload.getOrDefault("typing", false).toString());
            String recipientPrincipal = chatService.getRecipientEmail(auth, convId);

            if (recipientPrincipal != null && !recipientPrincipal.equals(auth.getName())) {
                messagingTemplate.convertAndSendToUser(recipientPrincipal, "/queue/typing",
                        Map.of("conversationId", convId, "senderEmail", senderName, "typing", isTyping));
            }
        } catch (Exception e) {
            log.debug("Typing event error: {}", e.getMessage());
        }
    }

    /**
     * Read receipt: /app/chat.read
     * Payload: {conversationId}
     * Notifies the sender that their messages were read.
     */
    @MessageMapping("/chat.read")
    public void markRead(@Payload Map<String, Object> payload, Authentication auth) {
        try {
            Long convId = Long.valueOf(payload.get("conversationId").toString());
            chatService.markAllRead(auth, convId);
            String recipientPrincipal = chatService.getRecipientEmail(auth, convId);

            if (recipientPrincipal != null && !recipientPrincipal.equals(auth.getName())) {
                messagingTemplate.convertAndSendToUser(recipientPrincipal, "/queue/read-receipt",
                        Map.of("conversationId", convId, "readByEmail", auth.getName()));
            }
        } catch (Exception e) {
            log.debug("Read receipt error: {}", e.getMessage());
        }
    }
}
