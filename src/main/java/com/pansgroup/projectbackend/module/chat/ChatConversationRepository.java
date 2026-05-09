package com.pansgroup.projectbackend.module.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {

    /** Find existing conversation between two users (order-independent). */
    @Query("SELECT c FROM ChatConversation c WHERE " +
           "(c.userA.id = :aId AND c.userB.id = :bId) OR " +
           "(c.userA.id = :bId AND c.userB.id = :aId)")
    Optional<ChatConversation> findByParticipants(@Param("aId") Long aId, @Param("bId") Long bId);

    /** All conversations for a given user, sorted by most recent message. */
    @Query("SELECT c FROM ChatConversation c WHERE " +
           "c.userA.id = :userId OR c.userB.id = :userId " +
           "ORDER BY c.lastMessageAt DESC")
    List<ChatConversation> findAllForUser(@Param("userId") Long userId);

    /** Count conversations where the user is a participant. */
    @Query("SELECT COUNT(c) FROM ChatConversation c WHERE c.userA.id = :userId OR c.userB.id = :userId")
    long countForUser(@Param("userId") Long userId);
}
