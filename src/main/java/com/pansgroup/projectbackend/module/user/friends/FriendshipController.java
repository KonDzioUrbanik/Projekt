package com.pansgroup.projectbackend.module.user.friends;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
@Tag(name = "Friends", description = "Zarządzanie znajomymi i zaproszeniami")
public class FriendshipController {
    private final FriendshipService friendshipService;
    private final UserService userService;

    @Operation(summary = "Wyślij zaproszenie do znajomych")
    @PostMapping("/request/{targetUserId}")
    public ResponseEntity<Void> sendRequest(@PathVariable Long targetUserId, Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        friendshipService.sendFriendRequest(currentUserId, targetUserId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Zaakceptuj zaproszenie do znajomych")
    @PostMapping("/accept/{requestId}")
    public ResponseEntity<Void> acceptRequest(@PathVariable Long requestId, Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        friendshipService.acceptFriendRequest(requestId, currentUserId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Zaakceptuj zaproszenie od konkretnego użytkownika")
    @PostMapping("/accept-user/{senderId}")
    public ResponseEntity<Void> acceptRequestFromUser(@PathVariable Long senderId, Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        friendshipService.acceptFriendRequestByUsers(senderId, currentUserId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Odrzuć zaproszenie do znajomych")
    @PostMapping("/reject/{requestId}")
    public ResponseEntity<Void> rejectRequest(@PathVariable Long requestId, Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        friendshipService.rejectFriendRequest(requestId, currentUserId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Usuń użytkownika ze znajomych")
    @DeleteMapping("/remove/{friendId}")
    public ResponseEntity<Void> removeFriend(@PathVariable Long friendId, Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        friendshipService.removeFriend(currentUserId, friendId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Pobierz listę znajomych")
    @GetMapping("/list")
    public List<FriendDTO> getFriends(Authentication authentication) {
        return friendshipService.getFriends(getCurrentUserId(authentication));
    }

    @Operation(summary = "Pobierz listę zaproszeń (otrzymanych)")
    @GetMapping("/pending")
    public List<FriendRequestDTO> getPendingRequests(Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        return friendshipService.getPendingRequests(currentUserId);
    }

    @Operation(summary = "Pobierz listę zaproszeń (wysłanych)")
    @GetMapping("/sent")
    public List<FriendRequestDTO> getSentRequests(Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        return friendshipService.getSentRequests(currentUserId);
    }

    @Operation(summary = "Anuluj wysłane zaproszenie")
    @PostMapping("/cancel/{requestId}")
    public ResponseEntity<Void> cancelRequest(@PathVariable Long requestId, Authentication authentication) {
        Long currentUserId = getCurrentUserId(authentication);
        friendshipService.cancelFriendRequest(requestId, currentUserId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Sprawdź status relacji z użytkownikiem")
    @GetMapping("/status/{userId}")
    public String getStatus(@PathVariable Long userId, Authentication authentication) {
        return friendshipService.getFriendshipStatus(getCurrentUserId(authentication), userId);
    }

    private Long getCurrentUserId(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userService.findUserByEmailInternal(userDetails.getUsername());
        return user.getId();
    }
}
