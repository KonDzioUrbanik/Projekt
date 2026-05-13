package com.pansgroup.projectbackend.module.user.presence;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserPresenceService {

    private final SimpMessagingTemplate messagingTemplate;
    
    // Mapa: sessionId -> email
    private final Map<String, String> sessionToEmail = new ConcurrentHashMap<>();
    
    // Mapa: email -> Set of active sessionIds
    private final Map<String, Set<String>> userSessions = new ConcurrentHashMap<>();
    
    // Zaplanowane zadania rozłączenia (email -> Task)
    private final Map<String, ScheduledFuture<?>> pendingDisconnects = new ConcurrentHashMap<>();
    
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    
    // Zbiór e-maili uważanych za online (widocznych dla innych)
    private final Set<String> onlineUsers = Collections.newSetFromMap(new ConcurrentHashMap<>());

    /**
     * Rejestruje nową sesję użytkownika jako aktywną.
     */
    public void markAsOnline(String sessionId, String email) {
        if (email == null) return;
        String normalizedEmail = email.toLowerCase();
        
        sessionToEmail.put(sessionId, normalizedEmail);
        userSessions.computeIfAbsent(normalizedEmail, k -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                .add(sessionId);
        
        // Anuluj zaplanowane rozłączenie jeśli istniało
        ScheduledFuture<?> pending = pendingDisconnects.remove(normalizedEmail);
        if (pending != null) {
            pending.cancel(false);
            log.debug("[Presence] Anulowano planowane rozłączenie dla {}", normalizedEmail);
        }

        if (onlineUsers.add(normalizedEmail)) {
            log.info("[Presence] Użytkownik {} jest teraz ONLINE", normalizedEmail);
            broadcastStatus(normalizedEmail, true);
        }
    }

    /**
     * Usuwa sesję i sprawdza, czy użytkownik całkowicie opuścił aplikację (z opóźnieniem).
     */
    public void markAsOffline(String sessionId) {
        String email = sessionToEmail.remove(sessionId);
        if (email == null) return;

        Set<String> sessions = userSessions.get(email);
        if (sessions != null) {
            sessions.remove(sessionId);
            if (sessions.isEmpty()) {
                userSessions.remove(email);
                scheduleOffline(email);
            }
        }
    }

    private void scheduleOffline(String email) {
        // Jeśli już coś planujemy, anuluj stare
        ScheduledFuture<?> old = pendingDisconnects.remove(email);
        if (old != null) old.cancel(false);

        log.debug("[Presence] Zaplanowano przejście w tryb OFFLINE dla {} za 60s (Bufor usypiania kart)", email);
        
        ScheduledFuture<?> task = scheduler.schedule(() -> {
            pendingDisconnects.remove(email);
            if (onlineUsers.remove(email)) {
                log.info("[Presence] Użytkownik {} jest teraz OFFLINE (po 60s ciszy)", email);
                broadcastStatus(email, false);
            }
        }, 60, TimeUnit.SECONDS);

        pendingDisconnects.put(email, task);
    }

    /**
     * Zwraca listę wszystkich e-maili użytkowników online.
     */
    public Set<String> getOnlineUsers() {
        return Collections.unmodifiableSet(onlineUsers);
    }

    /**
     * Sprawdza czy konkretny użytkownik jest online.
     */
    public boolean isUserOnline(String email) {
        return onlineUsers.contains(email);
    }

    private void broadcastStatus(String email, boolean online) {
        UserStatusUpdate update = new UserStatusUpdate(email, online);
        messagingTemplate.convertAndSend("/topic/users/status", update);
    }

    public record UserStatusUpdate(String email, boolean online) {}
}
