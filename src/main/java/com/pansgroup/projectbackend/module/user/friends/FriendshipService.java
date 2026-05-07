package com.pansgroup.projectbackend.module.user.friends;

import com.pansgroup.projectbackend.module.user.User;

import com.pansgroup.projectbackend.module.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FriendshipService {
    private final FriendshipRepository friendshipRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;
    private final com.pansgroup.projectbackend.module.notification.NotificationService notificationService;

    @Transactional
    public void sendFriendRequest(Long senderId, Long receiverId) {
        // Limit anty-spamowy: max 50 oczekujących zaproszeń wysłanych przez jednego użytkownika
        long pendingCount = friendRequestRepository.countBySenderIdAndStatus(senderId, FriendRequestStatus.PENDING);
        if (pendingCount >= 50) {
            throw new IllegalStateException("Osiągnąłeś limit 50 oczekujących zaproszeń. Poczekaj na ich rozpatrzenie.");
        }
        if (senderId.equals(receiverId)) {
            throw new IllegalArgumentException("Nie możesz zaprosić samego siebie.");
        }

        if (friendshipRepository.areFriends(senderId, receiverId)) {
            throw new IllegalStateException("Jesteście już znajomymi.");
        }

        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(senderId, receiverId,
                FriendRequestStatus.PENDING)) {
            throw new IllegalStateException("Zaproszenie zostało już wysłane.");
        }

        if (senderId == null || receiverId == null) {
            throw new IllegalArgumentException("Identyfikatory użytkowników nie mogą być puste.");
        }
        User sender = userRepository.findById(java.util.Objects.requireNonNull(senderId)).orElseThrow();
        User receiver = userRepository.findById(java.util.Objects.requireNonNull(receiverId)).orElseThrow();

        if (isAdmin(sender) || isAdmin(receiver)) {
            throw new IllegalStateException("Uruchomienie procedury relacji z kontem administracyjnym jest niemożliwe.");
        }

        FriendRequest request = new FriendRequest();
        request.setSender(sender);
        request.setReceiver(receiver);
        request.setStatus(FriendRequestStatus.PENDING);
        friendRequestRepository.save(request);

        notificationService.createNotification(
                receiver,
                com.pansgroup.projectbackend.module.notification.NotificationType.FRIEND_REQUEST,
                sender.getFirstName() + " " + sender.getLastName() + " wysłał(a) Ci zaproszenie do znajomych.",
                "/profile/user?userId=" + sender.getId()
        );
    }

    private boolean isAdmin(User user) {
        if (user == null || user.getRole() == null) return false;
        String role = user.getRole().toUpperCase();
        return role.contains("ADMIN");
    }

    @Transactional
    public void acceptFriendRequest(Long requestId, Long currentUserId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono zaproszenia."));

        if (!request.getReceiver().getId().equals(currentUserId)) {
            throw new IllegalStateException("Nie możesz zaakceptować cudzego zaproszenia.");
        }

        request.setStatus(FriendRequestStatus.ACCEPTED);
        friendRequestRepository.save(request);

        Friendship friendship = new Friendship(request.getSender(), request.getReceiver());
        friendshipRepository.save(friendship);
    }

    @Transactional
    public void acceptFriendRequestByUsers(Long senderId, Long receiverId) {
        FriendRequest request = friendRequestRepository.findBySenderIdAndReceiverIdAndStatus(senderId, receiverId,
                FriendRequestStatus.PENDING)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono zaproszenia od tego użytkownika."));
        acceptFriendRequest(request.getId(), receiverId);
    }

    @Transactional
    public void rejectFriendRequest(Long requestId, Long currentUserId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono zaproszenia."));

        if (!request.getReceiver().getId().equals(currentUserId)) {
            throw new IllegalStateException("Nie możesz odrzucić cudzego zaproszenia.");
        }

        request.setStatus(FriendRequestStatus.REJECTED);
        friendRequestRepository.save(request);
    }

    @Transactional
    public void cancelFriendRequest(Long requestId, Long currentUserId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono zaproszenia."));

        if (!request.getSender().getId().equals(currentUserId)) {
            throw new IllegalStateException("Nie możesz anulować cudzego zaproszenia.");
        }

        friendRequestRepository.delete(request);
    }

    public List<FriendDTO> getFriends(Long userId) {
        Long uid = userId;
        if (uid == null) return java.util.Collections.emptyList();
        return friendshipRepository.findAllFriends(uid).stream()
                .map(f -> {
                    User friend = f.getUser1().getId().equals(userId) ? f.getUser2() : f.getUser1();
                    return mapToDTO(friend, f.getId());
                })
                .collect(Collectors.toList());
    }

    public List<FriendRequestDTO> getPendingRequests(Long userId) {
        return friendRequestRepository.findAllByReceiverIdAndStatus(userId, FriendRequestStatus.PENDING).stream()
                .map(r -> new FriendRequestDTO(
                        r.getId(),
                        r.getSender().getId(),
                        r.getSender().getFirstName() + " " + r.getSender().getLastName(),
                        r.getSender().getEmail(),
                        r.getCreatedAt()))
                .collect(Collectors.toList());
    }

    public List<FriendRequestDTO> getSentRequests(Long userId) {
        return friendRequestRepository.findAllBySenderIdAndStatus(userId, FriendRequestStatus.PENDING).stream()
                .map(r -> new FriendRequestDTO(
                        r.getId(),
                        r.getReceiver().getId(),
                        r.getReceiver().getFirstName() + " " + r.getReceiver().getLastName(),
                        r.getReceiver().getEmail(),
                        r.getCreatedAt()))
                .collect(Collectors.toList());
    }

    public String getFriendshipStatus(Long currentUserId, Long targetUserId) {
        if (currentUserId.equals(targetUserId))
            return "SELF";
        User current = userRepository.findById(currentUserId).orElseThrow();
        User target = userRepository.findById(targetUserId).orElseThrow();
        if (isAdmin(current) || isAdmin(target)) return "LOCKED";

        if (friendshipRepository.areFriends(currentUserId, targetUserId))
            return "FRIENDS";
        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(currentUserId, targetUserId,
                FriendRequestStatus.PENDING))
            return "SENT";
        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(targetUserId, currentUserId,
                FriendRequestStatus.PENDING))
            return "RECEIVED";
        return "NONE";
    }

    @Transactional
    public void removeFriend(Long currentUserId, Long friendId) {
        if (currentUserId == null || friendId == null) {
            throw new IllegalArgumentException("Identyfikatory nie mogą być puste.");
        }
        Friendship friendship = friendshipRepository.findRelation(currentUserId, friendId)
                .orElseThrow(() -> new IllegalArgumentException("Nie jesteście znajomymi."));
        friendshipRepository.delete(friendship);
    }

    private FriendDTO mapToDTO(User user, Long friendshipId) {
        return new FriendDTO(
                friendshipId,
                user.getId(),
                user.getFirstName() + " " + user.getLastName(),
                user.getEmail(),
                user.getFieldOfStudy(),
                user.getYearOfStudy(),
                user.getAvatarData() != null);
    }
}
