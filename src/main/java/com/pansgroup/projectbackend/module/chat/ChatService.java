package com.pansgroup.projectbackend.module.chat;

import com.pansgroup.projectbackend.module.chat.dto.*;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatService {

    private static final int MESSAGE_PAGE_SIZE = 50;
    private static final int EDIT_WINDOW_MINUTES = 5;

    private final ChatConversationRepository conversationRepo;
    private final ChatMessageRepository messageRepo;
    private final UserRepository userRepository;
    private final ChatCryptoService crypto;

    // User resolution helpers

    public User resolveUser(Authentication auth) {
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new EntityNotFoundException("Użytkownik nie znaleziony"));
    }

    // Package-accessible for WebSocket controller to route messages to correct user
    // queues.
    public ChatConversation getConversationForWs(Long convId, User me) {
        return getConversationSecure(convId, me);
    }

    private void assertNotAdmin(User user) {
        if ("ADMIN".equalsIgnoreCase(user.getRole()) || "ROLE_ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new AccessDeniedException("Administratorzy nie mogą korzystać z czatu.");
        }
    }

    // User search

    public List<UserSearchResultDto> searchUsers(Authentication auth, String query) {
        User me = resolveUser(auth);
        assertNotAdmin(me);

        if (query == null || query.isBlank() || query.length() < 2) {
            return List.of();
        }
        String q = "%" + query.trim().toLowerCase() + "%";
        return userRepository.searchChatUsers(q, me.getId()).stream()
                .map(u -> new UserSearchResultDto(
                        u.getId(),
                        u.getFirstName() + " " + u.getLastName(),
                        u.getFieldOfStudy(),
                        u.getYearOfStudy(),
                        u.getRole()))
                .collect(Collectors.toList());
    }

    // Conversations

    @Transactional
    public ConversationDto getOrCreateConversation(Authentication auth, Long otherUserId) {
        User me = resolveUser(auth);
        assertNotAdmin(me);

        User other = userRepository.findById(otherUserId)
                .orElseThrow(() -> new EntityNotFoundException("Użytkownik docelowy nie istnieje"));

        if ("ADMIN".equalsIgnoreCase(other.getRole()) || "ROLE_ADMIN".equalsIgnoreCase(other.getRole())) {
            throw new AccessDeniedException("Nie można pisać do administratora.");
        }

        // Normalize pair: lower id is always userA
        User userA = me.getId() < other.getId() ? me : other;
        User userB = me.getId() < other.getId() ? other : me;

        ChatConversation conv = conversationRepo.findByParticipants(userA.getId(), userB.getId())
                .orElseGet(() -> {
                    ChatConversation nc = new ChatConversation();
                    nc.setUserA(userA);
                    nc.setUserB(userB);
                    return conversationRepo.save(nc);
                });

        long unread = messageRepo.countUnread(conv.getId(), me.getId());
        return toConversationDto(conv, me, unread, null, null);
    }

    public List<ConversationDto> getMyConversations(Authentication auth) {
        User me = resolveUser(auth);
        assertNotAdmin(me);

        return conversationRepo.findAllForUser(me.getId()).stream()
                .map(conv -> {
                    long unread = messageRepo.countUnread(conv.getId(), me.getId());
                    // Fetch last message for preview
                    List<ChatMessage> last = messageRepo.findByConversation(conv.getId(), PageRequest.of(0, 1));
                    String preview = null;
                    LocalDateTime previewTs = null;
                    if (!last.isEmpty()) {
                        ChatMessage lm = last.get(0);
                        if (lm.isDeleted()) {
                            preview = "[Wiadomość usunięta]";
                        } else {
                            try {
                                String plain = crypto.decrypt(lm.getContent());
                                String prefix = lm.getSender().getId().equals(me.getId()) ? "Ty: " : "";
                                preview = prefix + (plain.length() > 60 ? plain.substring(0, 60) + "…" : plain);
                            } catch (Exception e) {
                                preview = "…";
                            }
                        }
                        previewTs = lm.getSentAt();
                    }
                    return toConversationDto(conv, me, unread, preview, previewTs);
                })
                .collect(Collectors.toList());
    }

    private ConversationDto toConversationDto(ChatConversation conv, User me, long unread, String preview,
            LocalDateTime previewTs) {
        User other = conv.getUserA().getId().equals(me.getId()) ? conv.getUserB() : conv.getUserA();
        return new ConversationDto(
                conv.getId(),
                other.getId(),
                other.getFirstName() + " " + other.getLastName(),
                other.getFieldOfStudy(),
                other.getYearOfStudy(),
                other.getRole(),
                unread,
                preview,
                previewTs);
    }

    // Messages

    public List<MessageDto> getMessages(Authentication auth, Long conversationId, Long beforeId) {
        User me = resolveUser(auth);
        assertNotAdmin(me);

        ChatConversation conv = getConversationSecure(conversationId, me);

        List<ChatMessage> msgs;
        if (beforeId == null) {
            msgs = messageRepo.findByConversation(conv.getId(), PageRequest.of(0, MESSAGE_PAGE_SIZE));
        } else {
            msgs = messageRepo.findByConversationBefore(conv.getId(), beforeId, PageRequest.of(0, MESSAGE_PAGE_SIZE));
        }

        return msgs.stream()
                .map(m -> toMessageDto(m, me))
                .collect(Collectors.toList());
    }

    private final java.util.Map<Long, Long> messageRateMap = new java.util.concurrent.ConcurrentHashMap<>();

    @Transactional
    public MessageDto sendMessage(Authentication auth, Long conversationId, String plaintext) {
        User sender = resolveUser(auth);
        assertNotAdmin(sender);

        long now = System.currentTimeMillis();
        long lastMs = messageRateMap.getOrDefault(sender.getId(), 0L);
        if (now - lastMs < 500) {
            throw new IllegalStateException("Przekroczono limit wiadomości (max 1 na 500ms). Zwolnij!");
        }
        messageRateMap.put(sender.getId(), now);

        if (plaintext == null || plaintext.isBlank()) {
            throw new IllegalArgumentException("Wiadomość nie może być pusta.");
        }
        if (plaintext.length() > 4000) {
            throw new IllegalArgumentException("Wiadomość jest za długa (max 4000 znaków).");
        }

        ChatConversation conv = getConversationSecure(conversationId, sender);
        conv.setLastMessageAt(LocalDateTime.now());

        // Sanityzacja HTML (ochrona XSS) – dla czatu wystarczy prosty tekst (pogrubienie, kursywa)
        String cleanText = Jsoup.clean(plaintext.trim(), Safelist.simpleText());
        if (cleanText.isBlank()) {
             throw new IllegalArgumentException("Wiadomość po sanityzacji jest pusta.");
        }

        ChatMessage msg = new ChatMessage();
        msg.setConversation(conv);
        msg.setSender(sender);
        msg.setContent(crypto.encrypt(cleanText));
        msg.setStatus(ChatMessage.MessageStatus.SENT);
        messageRepo.save(msg);

        log.debug("Chat message saved: conv={} sender={}", conversationId, sender.getId());
        return toMessageDto(msg, sender);
    }

    @Transactional
    public MessageDto editMessage(Authentication auth, Long messageId, String newContent) {
        User me = resolveUser(auth);
        assertNotAdmin(me);

        ChatMessage msg = messageRepo.findById(messageId)
                .orElseThrow(() -> new EntityNotFoundException("Wiadomość nie istnieje"));

        if (!msg.getSender().getId().equals(me.getId())) {
            throw new AccessDeniedException("Możesz edytować tylko swoje wiadomości.");
        }
        if (msg.isDeleted()) {
            throw new IllegalStateException("Nie można edytować usuniętej wiadomości.");
        }
        long minutesElapsed = Duration.between(msg.getSentAt(), LocalDateTime.now()).toMinutes();
        if (minutesElapsed > EDIT_WINDOW_MINUTES) {
            throw new IllegalStateException("Okno edycji wygasło (max " + EDIT_WINDOW_MINUTES + " minut po wysłaniu).");
        }
        if (newContent == null || newContent.isBlank() || newContent.length() > 4000) {
            throw new IllegalArgumentException("Nieprawidłowa treść wiadomości.");
        }

        String cleanText = Jsoup.clean(newContent.trim(), Safelist.simpleText());
        if (cleanText.isBlank()) {
            throw new IllegalArgumentException("Wiadomość po edycji i sanityzacji jest pusta.");
        }

        msg.setContent(crypto.encrypt(cleanText));
        msg.setEditedAt(LocalDateTime.now());
        return toMessageDto(msg, me);
    }

    @Transactional
    public MessageDto deleteMessage(Authentication auth, Long messageId) {
        User me = resolveUser(auth);
        assertNotAdmin(me);

        ChatMessage msg = messageRepo.findById(messageId)
                .orElseThrow(() -> new EntityNotFoundException("Wiadomość nie istnieje"));

        if (!msg.getSender().getId().equals(me.getId())) {
            throw new AccessDeniedException("Możesz usunąć tylko swoje wiadomości.");
        }
        if (msg.isDeleted()) {
            throw new IllegalStateException("Wiadomość już usunięta.");
        }

        msg.setContent(null); // Erase encrypted content
        msg.setDeletedAt(LocalDateTime.now());
        return toMessageDto(msg, me);
    }

    @Transactional
    public void markAllRead(Authentication auth, Long conversationId) {
        User me = resolveUser(auth);
        assertNotAdmin(me);
        getConversationSecure(conversationId, me);
        messageRepo.markAllRead(conversationId, me.getId());
    }

    public long getTotalUnread(Authentication auth) {
        User me = resolveUser(auth);
        if ("ADMIN".equalsIgnoreCase(me.getRole()) || "ROLE_ADMIN".equalsIgnoreCase(me.getRole())) {
            return 0;
        }
        return messageRepo.countTotalUnread(me.getId());
    }

    public String getRecipientEmail(Authentication auth, Long convId) {
        try {
            User me = resolveUser(auth);
            ChatConversation conv = getConversationSecure(convId, me);
            User other = conv.getUserA().getId().equals(me.getId()) ? conv.getUserB() : conv.getUserA();
            return other.getEmail();
        } catch (Exception e) {
            return null;
        }
    }

    // Helpers

    private ChatConversation getConversationSecure(Long id, User me) {
        ChatConversation conv = conversationRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Konwersacja nie istnieje"));
        boolean participant = conv.getUserA().getId().equals(me.getId())
                || conv.getUserB().getId().equals(me.getId());
        if (!participant) {
            throw new jakarta.persistence.EntityNotFoundException("Konwersacja nie istnieje");
        }
        return conv;
    }

    private MessageDto toMessageDto(ChatMessage m, User me) {
        String content;
        if (m.isDeleted()) {
            content = null;
        } else {
            try {
                content = crypto.decrypt(m.getContent());
            } catch (Exception e) {
                content = "[błąd odczytu]";
            }
        }
        return new MessageDto(
                m.getId(),
                m.getConversation().getId(),
                m.getSender().getId(),
                m.getSender().getFirstName() + " " + m.getSender().getLastName(),
                content,
                m.getSentAt(),
                m.getEditedAt(),
                m.getDeletedAt(),
                m.getStatus().name(),
                m.getSender().getId().equals(me.getId()));
    }
}
