package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.forum.dto.*;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;

@Service
@Transactional
public class ForumServiceImpl implements ForumService {

    private static final Logger log = LoggerFactory.getLogger(ForumServiceImpl.class);
 
    private static final int MAX_ATTACHMENTS = 5;
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    private final ForumThreadRepository forumThreadRepository;
    private final ForumCommentRepository forumCommentRepository;
    private final ForumThreadVoteRepository forumThreadVoteRepository;
    private final ForumCommentVoteRepository forumCommentVoteRepository;
    private final ForumThreadAttachmentRepository forumThreadAttachmentRepository;
    private final ForumCommentAttachmentRepository forumCommentAttachmentRepository;
    private final UserRepository userRepository;
    private final StudentGroupRepository studentGroupRepository;
    private final com.pansgroup.projectbackend.module.notification.NotificationService notificationService;

    public ForumServiceImpl(ForumThreadRepository forumThreadRepository,
                            ForumCommentRepository forumCommentRepository,
                            ForumThreadVoteRepository forumThreadVoteRepository,
                            ForumCommentVoteRepository forumCommentVoteRepository,
                            ForumThreadAttachmentRepository forumThreadAttachmentRepository,
                            ForumCommentAttachmentRepository forumCommentAttachmentRepository,
                            UserRepository userRepository,
                            StudentGroupRepository studentGroupRepository,
                            com.pansgroup.projectbackend.module.notification.NotificationService notificationService) {
        this.forumThreadRepository = forumThreadRepository;
        this.forumCommentRepository = forumCommentRepository;
        this.forumThreadVoteRepository = forumThreadVoteRepository;
        this.forumCommentVoteRepository = forumCommentVoteRepository;
        this.forumThreadAttachmentRepository = forumThreadAttachmentRepository;
        this.forumCommentAttachmentRepository = forumCommentAttachmentRepository;
        this.userRepository = userRepository;
        this.studentGroupRepository = studentGroupRepository;
        this.notificationService = notificationService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ForumThreadResponseDto> getFeed(boolean includeArchived) {
        User currentUser = getCurrentUser();
        try {
            if (isAdmin(currentUser)) {
                List<ForumThread> all = forumThreadRepository.findAllByOrderByArchivedAscPinnedDescCreatedAtDesc();
                if (!includeArchived) {
                    all = all.stream().filter(t -> !t.isArchived()).toList();
                }
                return all.stream().map(t -> mapThread(t, currentUser)).toList();
            }

            StudentGroup group = currentUser.getStudentGroup();
            if (group == null || group.getId() == null) {
                return List.of();
            }

            List<ForumThread> feed = includeArchived
                    ? forumThreadRepository.findByStudentGroup_IdOrderByArchivedAscPinnedDescCreatedAtDesc(group.getId())
                    : forumThreadRepository.findByStudentGroup_IdAndArchivedFalseOrderByPinnedDescCreatedAtDesc(group.getId());
            return feed.stream().map(t -> mapThread(t, currentUser)).toList();
        } catch (DataAccessException ex) {
            log.error("Forum feed DB error for user {}: {}", currentUser.getEmail(), ex.getMessage(), ex);
            return List.of();
        }
    }

    @Override
    public ForumThreadResponseDto createThread(ForumThreadCreateDto dto, List<MultipartFile> files) {
        User currentUser = getCurrentUser();
        StudentGroup targetGroup;

        if (isAdmin(currentUser) && dto.targetGroupId() != null) {
            targetGroup = studentGroupRepository.findById(dto.targetGroupId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybrana grupa nie istnieje."));
        } else {
            targetGroup = requireOwnGroup(currentUser);
        }

        ForumThread thread = new ForumThread();
        thread.setTitle(cleanText(dto.title(), 180, "Tytuł wątku"));
        thread.setContent(cleanText(dto.content(), 4000, "Treść wątku"));
        thread.setAuthor(currentUser);
        thread.setStudentGroup(targetGroup);

        ForumThread saved = forumThreadRepository.save(thread);
        saveThreadAttachments(saved, files);
        return mapThread(saved, currentUser);
    }

    @Override
    @Transactional(readOnly = true)
    public ForumThreadResponseDto getThread(Long id) {
        User currentUser = getCurrentUser();
        ForumThread thread = findThread(id);
        ensureAccess(thread, currentUser);
        return mapThread(thread, currentUser);
    }

    @Override
    public ForumThreadResponseDto addComment(Long threadId, ForumCommentCreateDto dto, List<MultipartFile> files) {
        User currentUser = getCurrentUser();
        ForumThread thread = findThread(threadId);
        ensureAccess(thread, currentUser);

        if (thread.isArchived()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie można komentować zarchiwizowanego wątku.");
        }
        if (thread.isLocked()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wątek jest zablokowany przez moderatora.");
        }

        ForumComment comment = new ForumComment();
        comment.setThread(thread);
        comment.setAuthor(currentUser);
        comment.setContent(cleanText(dto.content(), 2000, "Komentarz"));
        ForumComment saved = forumCommentRepository.save(comment);
        saveCommentAttachments(saved, files);

        // Wysyłanie powiadomień
        java.util.Set<User> recipientsToNotify = new java.util.HashSet<>();
        
        // Autor wątku
        if (thread.getAuthor() != null && !Objects.equals(thread.getAuthor().getId(), currentUser.getId())) {
            recipientsToNotify.add(thread.getAuthor());
        }
        
        // Inni komentujący
        if (thread.getComments() != null) {
            for (ForumComment c : thread.getComments()) {
                if (c.getAuthor() != null && !Objects.equals(c.getAuthor().getId(), currentUser.getId())) {
                    recipientsToNotify.add(c.getAuthor());
                }
            }
        }
        
        String notificationMessage = currentUser.getFirstName() + " " + currentUser.getLastName() + " dodał(a) komentarz w wątku: " + thread.getTitle();
        String notificationUrl = "/student/forum";
        
        for (User recipient : recipientsToNotify) {
            notificationService.createNotification(
                    recipient,
                    com.pansgroup.projectbackend.module.notification.NotificationType.FORUM_COMMENT,
                    notificationMessage,
                    notificationUrl
            );
        }

        ForumThread refreshed = findThread(threadId);
        return mapThread(refreshed, currentUser);
    }

    @Override
    public ForumThreadResponseDto updateThread(Long id, ForumThreadUpdateDto dto) {
        User currentUser = getCurrentUser();
        ForumThread thread = findThread(id);
        ensureAccess(thread, currentUser);

        boolean isOwner = thread.getAuthor() != null && Objects.equals(thread.getAuthor().getId(), currentUser.getId());
        if (!isAdmin(currentUser) && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do edycji wątku.");
        }

        thread.setTitle(cleanText(dto.title(), 180, "Tytuł wątku"));
        thread.setContent(cleanText(dto.content(), 4000, "Treść wątku"));
        ForumThread saved = forumThreadRepository.save(thread);
        return mapThread(saved, currentUser);
    }

    @Override
    public ForumThreadResponseDto updateComment(Long threadId, Long commentId, ForumCommentUpdateDto dto) {
        User currentUser = getCurrentUser();
        ForumThread thread = findThread(threadId);
        ensureAccess(thread, currentUser);

        ForumComment comment = thread.getComments().stream()
                .filter(c -> Objects.equals(c.getId(), commentId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono komentarza."));

        if (comment.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie można edytować usuniętego komentarza.");
        }

        boolean isCommentOwner = comment.getAuthor() != null && Objects.equals(comment.getAuthor().getId(), currentUser.getId());
        if (!isAdmin(currentUser) && !isCommentOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do edycji komentarza.");
        }

        comment.setContent(cleanText(dto.content(), 2000, "Komentarz"));
        forumCommentRepository.save(comment);

        ForumThread refreshed = findThread(threadId);
        return mapThread(refreshed, currentUser);
    }

    @Override
    public void deleteThread(Long id) {
        User currentUser = getCurrentUser();
        ForumThread thread = findThread(id);

        boolean isOwner = Objects.equals(thread.getAuthor().getId(), currentUser.getId());
        boolean isGroupModerator = isStarosta(currentUser) && 
                currentUser.getStudentGroup() != null &&
                thread.getStudentGroup() != null &&
                Objects.equals(currentUser.getStudentGroup().getId(), thread.getStudentGroup().getId());

        if (!isAdmin(currentUser) && !isOwner && !isGroupModerator) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do usunięcia wątku.");
        }

        forumThreadRepository.delete(thread);
    }

    @Override
    public ForumThreadResponseDto deleteComment(Long threadId, Long commentId) {
        User currentUser = getCurrentUser();
        ForumThread thread = findThread(threadId);
        ensureAccess(thread, currentUser);

        ForumComment comment = forumCommentRepository.findByIdAndThread_Id(commentId, threadId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono komentarza."));

        if (comment.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Komentarz został już usunięty.");
        }

        boolean isCommentAuthor = Objects.equals(comment.getAuthor().getId(), currentUser.getId());
        boolean isGroupModerator = isStarosta(currentUser) && 
                currentUser.getStudentGroup() != null &&
                thread.getStudentGroup() != null &&
                Objects.equals(currentUser.getStudentGroup().getId(), thread.getStudentGroup().getId());

        if (!isAdmin(currentUser) && !isCommentAuthor && !isGroupModerator) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do usunięcia komentarza.");
        }

        comment.setDeleted(true);
        comment.setContent("[Komentarz został usunięty]");
        forumCommentRepository.save(comment);

        ForumThread refreshed = findThread(threadId);
        return mapThread(refreshed, currentUser);
    }

    @Override
    public ForumThreadResponseDto voteThread(Long id, String voteType) {
        User currentUser = getCurrentUser();
        if (isAdmin(currentUser)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin nie może głosować na wątkach.");
        }
        ForumThread thread = findThread(id);
        ensureAccess(thread, currentUser);

        ForumThreadVote.VoteType type = ForumThreadVote.VoteType.valueOf(voteType.toUpperCase());

        var existingVote = forumThreadVoteRepository.findByThread_IdAndUser_Id(thread.getId(), currentUser.getId());

        if (existingVote.isPresent()) {
            ForumThreadVote vote = existingVote.get();
            if (vote.getVoteType() == type) {
                forumThreadVoteRepository.delete(vote);
            } else {
                vote.setVoteType(type);
                forumThreadVoteRepository.save(vote);
            }
        } else {
            ForumThreadVote vote = new ForumThreadVote();
            vote.setThread(thread);
            vote.setUser(currentUser);
            vote.setVoteType(type);
            forumThreadVoteRepository.save(vote);
        }

        ForumThread refreshed = findThread(id);
        return mapThread(refreshed, currentUser);
    }

    @Override
    public ForumThreadResponseDto voteComment(Long threadId, Long commentId, String voteType) {
        User currentUser = getCurrentUser();
        if (isAdmin(currentUser)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin nie może głosować na komentarzach.");
        }

        ForumThread thread = findThread(threadId);
        ensureAccess(thread, currentUser);

        ForumComment comment = thread.getComments().stream()
                .filter(c -> Objects.equals(c.getId(), commentId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono komentarza."));

        if (comment.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie można głosować na usuniętym komentarzu.");
        }

        ForumCommentVote.VoteType type = ForumCommentVote.VoteType.valueOf(voteType.toUpperCase());

        var existingVote = forumCommentVoteRepository.findByComment_IdAndUser_Id(comment.getId(), currentUser.getId());

        if (existingVote.isPresent()) {
            ForumCommentVote vote = existingVote.get();
            if (vote.getVoteType() == type) {
                forumCommentVoteRepository.delete(vote);
            } else {
                vote.setVoteType(type);
                forumCommentVoteRepository.save(vote);
            }
        } else {
            ForumCommentVote vote = new ForumCommentVote();
            vote.setComment(comment);
            vote.setUser(currentUser);
            vote.setVoteType(type);
            forumCommentVoteRepository.save(vote);
        }

        ForumThread refreshed = findThread(threadId);
        return mapThread(refreshed, currentUser);
    }

    @Override
    public ForumThreadResponseDto moderateThread(Long id, ForumThreadModerationDto dto) {
        User currentUser = getCurrentUser();
        if (!isAdmin(currentUser)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tylko admin może moderować forum.");
        }

        ForumThread thread = findThread(id);
        if (dto.locked() != null) {
            thread.setLocked(dto.locked());
        }
        if (dto.archived() != null) {
            thread.setArchived(dto.archived());
        }
        if (dto.pinned() != null) {
            thread.setPinned(dto.pinned());
        }

        ForumThread saved = forumThreadRepository.save(thread);
        return mapThread(saved, currentUser);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ForumThreadResponseDto> getUserThreads(Long userId) {
        User currentUser = getCurrentUser();
        return forumThreadRepository.findByAuthor_IdOrderByCreatedAtDesc(userId)
                .stream()
                .map(t -> mapThread(t, currentUser))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ForumCommentResponseDto> getUserComments(Long userId) {
        User currentUser = getCurrentUser();
        return forumCommentRepository.findByAuthor_IdOrderByCreatedAtDesc(userId)
                .stream()
                .map(c -> {
                    ForumThread thread = c.getThread();
                    return mapComment(c, thread, currentUser);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Map<String, Long> getUserForumStats(Long userId) {
        return java.util.Map.of(
                "threadsCount", forumThreadRepository.countByAuthor_Id(userId),
                "commentsCount", forumCommentRepository.countByAuthor_Id(userId)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public ForumThreadAttachment getAttachmentWithAccessCheck(Long attachmentId) {
        ForumThreadAttachment attachment = forumThreadAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono załącznika."));

        checkThreadAttachmentAccess(attachment);
        return attachment;
    }

    @Override
    @Transactional(readOnly = true)
    public ForumCommentAttachment getCommentAttachmentWithAccessCheck(Long attachmentId) {
        ForumCommentAttachment attachment = forumCommentAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono załącznika komentarza."));

        checkCommentAttachmentAccess(attachment);
        return attachment;
    }

    private void checkThreadAttachmentAccess(ForumThreadAttachment attachment) {
        User currentUser = getCurrentUser();
        ForumThread thread = attachment.getThread();

        if (isAdmin(currentUser)) {
            return;
        }

        StudentGroup group = currentUser.getStudentGroup();
        if (group == null || !Objects.equals(group.getId(), thread.getStudentGroup().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do tego załącznika.");
        }
    }

    private void checkCommentAttachmentAccess(ForumCommentAttachment attachment) {
        User currentUser = getCurrentUser();
        ForumThread thread = attachment.getComment().getThread();

        if (isAdmin(currentUser)) {
            return;
        }

        StudentGroup group = currentUser.getStudentGroup();
        if (group == null || !Objects.equals(group.getId(), thread.getStudentGroup().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do tego załącznika.");
        }
    }

    private void saveThreadAttachments(ForumThread thread, List<MultipartFile> files) {
        if (files == null || files.isEmpty())
            return;

        List<MultipartFile> nonEmpty = files.stream()
                .filter(f -> f != null && !f.isEmpty())
                .collect(Collectors.toList());

        if (nonEmpty.size() > MAX_ATTACHMENTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Można dodać maksymalnie " + MAX_ATTACHMENTS + " załączników.");
        }

        for (MultipartFile file : nonEmpty) {
            validateFile(file);
            try {
                ForumThreadAttachment attachment = new ForumThreadAttachment();
                attachment.setThread(thread);
                String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "plik";

                String sanitizedName = originalName.replaceAll("[\\n\\r]", "_").replace("\"", "'");
                attachment.setFileName(sanitizedName);
                attachment.setOriginalFileName(sanitizedName);
                attachment.setFilePath(sanitizedName);

                String extension = "";
                int lastDot = sanitizedName.lastIndexOf('.');
                if (lastDot > 0) {
                    extension = sanitizedName.substring(lastDot + 1).toLowerCase();
                }
                attachment.setFileExtension(extension);

                String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
                attachment.setContentType(contentType);
                attachment.setFileType(extension.toUpperCase());
                attachment.setFileSize(file.getSize());
                attachment.setFileData(file.getBytes());
                forumThreadAttachmentRepository.save(attachment);
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Nie można odczytać pliku: " + file.getOriginalFilename());
            }
        }
    }

    private void saveCommentAttachments(ForumComment comment, List<MultipartFile> files) {
        if (files == null || files.isEmpty())
            return;

        List<MultipartFile> nonEmpty = files.stream()
                .filter(f -> f != null && !f.isEmpty())
                .collect(Collectors.toList());

        if (nonEmpty.size() > MAX_ATTACHMENTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Można dodać maksymalnie " + MAX_ATTACHMENTS + " załączników.");
        }

        for (MultipartFile file : nonEmpty) {
            validateFile(file);
            try {
                ForumCommentAttachment attachment = new ForumCommentAttachment();
                attachment.setComment(comment);
                String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "plik";

                String sanitizedName = originalName.replaceAll("[\\n\\r]", "_").replace("\"", "'");
                attachment.setFileName(sanitizedName);
                attachment.setOriginalFileName(sanitizedName);
                attachment.setFilePath(sanitizedName);

                String extension = "";
                int lastDot = sanitizedName.lastIndexOf('.');
                if (lastDot > 0) {
                    extension = sanitizedName.substring(lastDot + 1).toLowerCase();
                }
                attachment.setFileExtension(extension);

                String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
                attachment.setContentType(contentType);
                attachment.setFileType(extension.toUpperCase());
                attachment.setFileSize(file.getSize());
                attachment.setFileData(file.getBytes());
                forumCommentAttachmentRepository.save(attachment);
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Nie można odczytać pliku: " + file.getOriginalFilename());
            }
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Plik \"" + file.getOriginalFilename() + "\" przekracza maksymalny rozmiar 5 MB.");
        }

        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Typ pliku " + contentType + " nie jest dozwolony. Dozwolone: JPG, PNG, WEBP, PDF, DOCX");
        }
    }

    private ForumThread findThread(Long id) {
        return forumThreadRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono wątku."));
    }

    private void ensureAccess(ForumThread thread, User user) {
        if (isAdmin(user)) {
            return;
        }

        StudentGroup group = requireOwnGroup(user);
        if (!Objects.equals(group.getId(), thread.getStudentGroup().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do wątków innej grupy.");
        }
    }

    private StudentGroup requireOwnGroup(User user) {
        if (user.getStudentGroup() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Użytkownik nie ma przypisanej grupy. Forum jest dostępne po przypisaniu do grupy.");
        }
        return user.getStudentGroup();
    }

    private ForumThreadResponseDto mapThread(ForumThread thread, User currentUser) {
        User author = thread.getAuthor();
        StudentGroup group = thread.getStudentGroup();
        Long authorId = author != null ? author.getId() : null;

        boolean canDelete = isAdmin(currentUser) || Objects.equals(authorId, currentUser.getId());
        boolean canEdit = canDelete;
        boolean canModerate = isAdmin(currentUser);

        long voteScore = thread.getId() == null ? 0 : (forumThreadVoteRepository.getVoteScore(thread.getId()) != null ? forumThreadVoteRepository.getVoteScore(thread.getId()) : 0);

        String currentUserVote = null;
        if (thread.getId() != null && currentUser.getId() != null) {
            var vote = forumThreadVoteRepository.findByThread_IdAndUser_Id(thread.getId(), currentUser.getId());
            if (vote.isPresent()) {
                currentUserVote = vote.get().getVoteType().toString();
            }
        }

        List<ForumCommentResponseDto> comments = (thread.getComments() == null ? List.<ForumComment>of() : thread.getComments())
                .stream()
                .sorted(Comparator.comparing(ForumComment::getCreatedAt))
                .map(c -> mapComment(c, thread, currentUser))
                .toList();

        List<com.pansgroup.projectbackend.module.forum.dto.AttachmentResponseDto> attachments = (thread.getAttachments() == null ? List.<ForumThreadAttachment>of() : thread.getAttachments())
                .stream()
                .map(a -> new com.pansgroup.projectbackend.module.forum.dto.AttachmentResponseDto(
                        a.getId(),
                        a.getOriginalFileName(),
                        a.getContentType(),
                        a.getFileSize()))
                .toList();

        return new ForumThreadResponseDto(
                thread.getId(),
                thread.getTitle(),
                thread.getContent(),
                thread.getCreatedAt(),
                thread.getUpdatedAt(),
                authorId,
                author != null ? author.getFirstName() : "Nieznany",
                author != null ? author.getLastName() : "autor",
                normalizeRole(author),
                group != null ? group.getId() : null,
                group != null ? group.getName() : "Bez grupy",
                thread.isLocked(),
                thread.isArchived(),
                thread.isPinned(),
                voteScore,
                currentUserVote,
                canEdit,
                canDelete,
                canModerate,
                comments,
                attachments
        );
    }

    private ForumCommentResponseDto mapComment(ForumComment comment, ForumThread thread, User currentUser) {
        boolean isDeleted = comment.isDeleted();
        User commentAuthor = comment.getAuthor();
        Long commentAuthorId = isDeleted ? null : (commentAuthor != null ? commentAuthor.getId() : null);
        boolean canDelete = !isDeleted && (isAdmin(currentUser)
                || Objects.equals(commentAuthor != null ? commentAuthor.getId() : null, currentUser.getId()));
        boolean canEdit = !isDeleted && (isAdmin(currentUser)
                || Objects.equals(commentAuthor != null ? commentAuthor.getId() : null, currentUser.getId()));

        long voteScore = comment.getId() == null ? 0 : (forumCommentVoteRepository.getVoteScore(comment.getId()) != null ? forumCommentVoteRepository.getVoteScore(comment.getId()) : 0);

        String currentUserVote = null;
        if (!isDeleted && comment.getId() != null && currentUser.getId() != null) {
            var vote = forumCommentVoteRepository.findByComment_IdAndUser_Id(comment.getId(), currentUser.getId());
            if (vote.isPresent()) {
                currentUserVote = vote.get().getVoteType().toString();
            }
        }

        List<com.pansgroup.projectbackend.module.forum.dto.AttachmentResponseDto> attachments = isDeleted
                ? List.of()
                : (comment.getAttachments() == null ? List.<ForumCommentAttachment>of() : comment.getAttachments())
                        .stream()
                        .map(a -> new com.pansgroup.projectbackend.module.forum.dto.AttachmentResponseDto(
                                a.getId(),
                                a.getOriginalFileName(),
                                a.getContentType(),
                                a.getFileSize()))
                        .toList();

        return new ForumCommentResponseDto(
                comment.getId(),
                thread.getId(),
                isDeleted ? "[Komentarz został usunięty]" : comment.getContent(),
                comment.getCreatedAt(),
                comment.getUpdatedAt(),
                commentAuthorId,
                isDeleted ? null : (commentAuthor != null ? commentAuthor.getFirstName() : "Nieznany"),
                isDeleted ? null : (commentAuthor != null ? commentAuthor.getLastName() : "autor"),
                isDeleted ? null : normalizeRole(commentAuthor),
                voteScore,
                currentUserVote,
                canEdit,
                canDelete,
                isDeleted,
                attachments
        );
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Użytkownik nie jest uwierzytelniony.");
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Użytkownik nie znaleziony: " + email));
    }

    private boolean isStarosta(User user) {
        return "STAROSTA".equalsIgnoreCase(user.getRole());
    }

    private boolean isAdmin(User user) {
        return "ADMIN".equals(normalizeRole(user));
    }

    private String normalizeRole(User user) {
        if (user == null) {
            return "";
        }
        return user.getRole() == null ? "" : user.getRole().toUpperCase().replace("ROLE_", "");
    }

    private String cleanText(String text, int maxLength, String fieldName) {
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " nie może być puste.");
        }

        // 1. Sanityzacja HTML (ochrona XSS)
        String cleaned = Jsoup.clean(text, Safelist.relaxed());

        // 2. Normalizacja spacji (usuwanie twardych spacji itp.)
        String normalized = cleaned.replace('\u00A0', ' ').trim();

        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " nie może zawierać samej białej znaki.");
        }

        if (normalized.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    fieldName + " przekracza maksymalną długość " + maxLength + " znaków.");
        }

        return normalized;
    }
}