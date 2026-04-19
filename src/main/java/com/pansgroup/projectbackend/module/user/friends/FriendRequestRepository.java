package com.pansgroup.projectbackend.module.user.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    List<FriendRequest> findAllByReceiverIdAndStatus(Long receiverId, FriendRequestStatus status);
    List<FriendRequest> findAllBySenderIdAndStatus(Long senderId, FriendRequestStatus status);
    Optional<FriendRequest> findBySenderIdAndReceiverIdAndStatus(Long senderId, Long receiverId, FriendRequestStatus status);
    boolean existsBySenderIdAndReceiverIdAndStatus(Long senderId, Long receiverId, FriendRequestStatus status);
}
