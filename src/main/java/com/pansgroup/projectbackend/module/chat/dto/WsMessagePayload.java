package com.pansgroup.projectbackend.module.chat.dto;

/** Payload sent over WebSocket for new messages and typing events. */
public record WsMessagePayload(
        Long conversationId,
        String content   // plaintext from client; server encrypts before persisting
) {}
