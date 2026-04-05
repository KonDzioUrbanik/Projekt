package com.pansgroup.projectbackend.module.chat;

import com.pansgroup.projectbackend.module.chat.dto.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import lombok.extern.slf4j.Slf4j;

/**
 * REST API for chat — conversations, message history, edit, delete, read receipts.
 */
@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ChatController {

    private final ChatService chatService;

    /** Search users for a new conversation. */
    @GetMapping("/users/search")
    public ResponseEntity<List<UserSearchResultDto>> searchUsers(
            Authentication auth,
            @RequestParam @Size(min = 2, max = 100) String q) {
        return ResponseEntity.ok(chatService.searchUsers(auth, q));
    }

    /** Get all conversations for the current user. */
    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationDto>> getConversations(Authentication auth) {
        return ResponseEntity.ok(chatService.getMyConversations(auth));
    }

    /** Get or create a conversation with otherUserId. */
    @PostMapping("/conversations")
    public ResponseEntity<?> openConversation(
            Authentication auth,
            @RequestBody Map<String, Object> body) {
        try {
            Object userIdObj = body.get("userId");
            if (userIdObj == null) {
                return ResponseEntity.badRequest().build();
            }
            Long otherId = ((Number) userIdObj).longValue();
            return ResponseEntity.ok(chatService.getOrCreateConversation(auth, otherId));
        } catch (Exception e) {
            log.error("Error creating conversation: ", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    /** Load messages for a conversation (cursor-based pagination). */
    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<MessageDto>> getMessages(
            Authentication auth,
            @PathVariable Long id,
            @RequestParam(required = false) Long before) {
        return ResponseEntity.ok(chatService.getMessages(auth, id, before));
    }

    /** Mark all unread messages in a conversation as READ. */
    @PatchMapping("/conversations/{id}/read")
    public ResponseEntity<Void> markRead(Authentication auth, @PathVariable Long id) {
        chatService.markAllRead(auth, id);
        return ResponseEntity.noContent().build();
    }

    /** Edit a message (within 5-minute window). */
    @PutMapping("/messages/{id}")
    public ResponseEntity<MessageDto> editMessage(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, @NotBlank @Size(max = 4000) String> body) {
        String content = body.get("content");
        return ResponseEntity.ok(chatService.editMessage(auth, id, content));
    }

    /** Soft-delete a message. */
    @DeleteMapping("/messages/{id}")
    public ResponseEntity<MessageDto> deleteMessage(Authentication auth, @PathVariable Long id) {
        return ResponseEntity.ok(chatService.deleteMessage(auth, id));
    }

    /** Total unread count for sidebar badge. */
    @GetMapping("/unread")
    public ResponseEntity<Map<String, Long>> getUnread(Authentication auth) {
        return ResponseEntity.ok(Map.of("count", chatService.getTotalUnread(auth)));
    }
}
