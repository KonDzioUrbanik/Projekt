package com.pansgroup.projectbackend.module.user.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    @Query("SELECT f FROM Friendship f WHERE f.user1.id = :userId OR f.user2.id = :userId")
    List<Friendship> findAllFriends(Long userId);

    @Query("SELECT f FROM Friendship f WHERE (f.user1.id = :u1 AND f.user2.id = :u2) OR (f.user1.id = :u2 AND f.user2.id = :u1)")
    Optional<Friendship> findRelation(Long u1, Long u2);

    @Query("SELECT COUNT(f) > 0 FROM Friendship f WHERE (f.user1.id = :u1 AND f.user2.id = :u2) OR (f.user1.id = :u2 AND f.user2.id = :u1)")
    boolean areFriends(Long u1, Long u2);
}
