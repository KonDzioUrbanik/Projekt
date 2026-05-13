package com.pansgroup.projectbackend.module.user.presence;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

@RestController
@RequestMapping("/api/users/presence")
@RequiredArgsConstructor
public class UserPresenceController {

    private final UserPresenceService presenceService;

    /**
     * Zwraca listę e-maili wszystkich aktualnie połączonych użytkowników.
     */
    @GetMapping("/online")
    public ResponseEntity<Set<String>> getOnlineUsers() {
        return ResponseEntity.ok(presenceService.getOnlineUsers());
    }
}
