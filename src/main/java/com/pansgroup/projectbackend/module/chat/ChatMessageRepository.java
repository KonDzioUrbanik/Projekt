package com.pansgroup.projectbackend.module.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /** Load messages for a conversation, newest first (for cursor pagination). */
    @Query("SELECT m FROM ChatMessage m WHERE m.conversation.id = :convId " +
           "ORDER BY m.sentAt DESC")
    List<ChatMessage> findByConversation(@Param("convId") Long convId, Pageable pageable);

    /** Cursor-based: load messages older than given id. */
    @Query("SELECT m FROM ChatMessage m WHERE m.conversation.id = :convId AND m.id < :beforeId " +
           "ORDER BY m.sentAt DESC")
    List<ChatMessage> findByConversationBefore(@Param("convId") Long convId,
                                               @Param("beforeId") Long beforeId,
                                               Pageable pageable);

    /** Count unread messages in a conversation that were NOT sent by this user. */
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.conversation.id = :convId " +
           "AND m.sender.id <> :userId AND m.status <> 'READ' AND m.deletedAt IS NULL")
    long countUnread(@Param("convId") Long convId, @Param("userId") Long userId);

    /** Mark all messages in a conversation as READ (bulk update). */
    @Modifying
    @Query("UPDATE ChatMessage m SET m.status = 'READ' WHERE m.conversation.id = :convId " +
           "AND m.sender.id <> :readerId AND m.status <> 'READ'")
    int markAllRead(@Param("convId") Long convId, @Param("readerId") Long readerId);

    /** Total unread across all conversations for a user (for sidebar badge). */
    @Query("SELECT COUNT(m) FROM ChatMessage m " +
           "JOIN m.conversation c " +
           "WHERE (c.userA.id = :userId OR c.userB.id = :userId) " +
           "AND m.sender.id <> :userId AND m.status <> 'READ' AND m.deletedAt IS NULL")
    long countTotalUnread(@Param("userId") Long userId);
}
