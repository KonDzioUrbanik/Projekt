package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.announcement.dto.*;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class AnnouncementServiceImpl implements AnnouncementService {

    private final Tika tika = new Tika();

    private static final int MAX_ATTACHMENTS = 5;
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    private final AnnouncementRepository announcementRepository;
    private final AnnouncementReadConfirmationRepository readConfirmationRepository;
    private final AnnouncementAttachmentRepository attachmentRepository;
    private final StudentGroupRepository studentGroupRepository;
    private final UserRepository userRepository;

    @Value("${app.upload.base-url:/api/announcements/attachments}")
    private String attachmentBaseUrl;

    public AnnouncementServiceImpl(AnnouncementRepository announcementRepository,
            AnnouncementReadConfirmationRepository readConfirmationRepository,
            AnnouncementAttachmentRepository attachmentRepository,
            StudentGroupRepository studentGroupRepository,
            UserRepository userRepository) {
        this.announcementRepository = announcementRepository;
        this.readConfirmationRepository = readConfirmationRepository;
        this.attachmentRepository = attachmentRepository;
        this.studentGroupRepository = studentGroupRepository;
        this.userRepository = userRepository;
    }

    // ── Create ──────────────────────────────────────────────────────────────────

    @Override
    public AnnouncementResponseDto createForOwnGroup(AnnouncementCreateDto dto, List<MultipartFile> files) {
        User currentUser = getCurrentUser();
        String role = normalizeRole(currentUser);

        if ("ADMIN".equals(role)) {
            return createForAdmin(dto, currentUser, files);
        }

        validateStarostaRole(currentUser);

        StudentGroup group = currentUser.getStudentGroup();
        if (group == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Starosta nie ma przypisanej grupy, więc nie może wysłać ogłoszenia.");
        }

        Announcement saved = announcementRepository.save(buildAnnouncement(dto, currentUser, group, null));
        saveAttachments(saved, files);
        return mapAnnouncementsForUser(List.of(saved), currentUser).get(0);
    }

    private AnnouncementResponseDto createForAdmin(AnnouncementCreateDto dto, User adminUser,
            List<MultipartFile> files) {
        if (Boolean.TRUE.equals(dto.global())) {
            List<StudentGroup> allGroups = studentGroupRepository.findAll();
            if (allGroups.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Brak grup docelowych. Dodaj kierunki, aby wysłać ogłoszenie globalne.");
            }

            String broadcastKey = "GLOBAL-" + UUID.randomUUID();
            Announcement firstSaved = null;
            for (StudentGroup group : allGroups) {
                Announcement saved = announcementRepository
                        .save(buildAnnouncement(dto, adminUser, group, broadcastKey));
                saveAttachments(saved, files); // Teraz przypisujemy załączniki do KAŻDEJ grupy
                if (firstSaved == null) {
                    firstSaved = saved;
                }
            }
            return mapAnnouncementsForUser(List.of(firstSaved), adminUser).get(0);
        }

        List<Long> groupIds = dto.targetGroupIds() == null ? List.of()
                : dto.targetGroupIds().stream().distinct().toList();
        if (groupIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Wybierz co najmniej jeden kierunek albo użyj trybu globalnego.");
        }

        List<StudentGroup> targetGroups = studentGroupRepository.findAllById(groupIds);
        if (targetGroups.size() != groupIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Co najmniej jeden z wybranych kierunków nie istnieje.");
        }

        Announcement firstSaved = null;
        for (StudentGroup group : targetGroups) {
            Announcement saved = announcementRepository.save(buildAnnouncement(dto, adminUser, group, null));
            saveAttachments(saved, files); // Przypisujemy do każdej wybranej grupy
            if (firstSaved == null) {
                firstSaved = saved;
            }
        }

        return mapAnnouncementsForUser(List.of(firstSaved), adminUser).get(0);
    }

    private void saveAttachments(Announcement announcement, List<MultipartFile> files) {
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
                AnnouncementAttachment attachment = new AnnouncementAttachment();
                attachment.setAnnouncement(announcement);
                String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "plik";
                // Sanityzacja nazwy pliku (zapobieganie Header Injection i Path Traversal)
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
                attachmentRepository.save(attachment);
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Nie można odczytać pliku: " + file.getOriginalFilename());
            }
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Plik '" + file.getOriginalFilename() + "' przekracza limit 5MB.");
        }

        try {
            // Deep inspection za pomocą Apache Tika (MIME sniffing)
            String detectedType = tika.detect(file.getInputStream());
            if (detectedType == null || !ALLOWED_CONTENT_TYPES.contains(detectedType.toLowerCase())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Niedozwolony typ zawartości pliku: " + detectedType + ". Dozwolone: JPG, PNG, PDF, DOCX.");
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Błąd podczas weryfikacji pliku.");
        }
    }

    /**
     * Weryfikuje czy użytkownik ma dostęp do załącznika.
     * Student/Starosta ma dostęp tylko do ogłoszeń swojej grupy.
     * Admin ma dostęp do wszystkiego.
     */
    public void checkAttachmentAccess(AnnouncementAttachment attachment) {
        User currentUser = getCurrentUser();
        String role = normalizeRole(currentUser);

        if ("ADMIN".equals(role))
            return;

        Announcement announcement = attachment.getAnnouncement();
        StudentGroup userGroup = currentUser.getStudentGroup();

        if (userGroup == null || announcement.getTargetGroup() == null ||
                !Objects.equals(userGroup.getId(), announcement.getTargetGroup().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do tego załącznika.");
        }
    }

    // ── Read ───────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<AnnouncementResponseDto> getCurrentUserGroupFeed() {
        User currentUser = getCurrentUser();
        StudentGroup group = currentUser.getStudentGroup();

        if (group == null)
            return List.of();

        List<Announcement> announcements = announcementRepository
                .findByTargetGroup_IdOrderByIsPinnedDescCreatedAtDesc(group.getId());
        return mapAnnouncementsForUser(announcements, currentUser);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AnnouncementResponseDto> getAllAnnouncements() {
        User currentUser = getCurrentUser();
        List<Announcement> announcements = announcementRepository.findAllByOrderByIsPinnedDescCreatedAtDesc();
        if ("ADMIN".equals(normalizeRole(currentUser))) {
            return mapAnnouncementsForAdmin(announcements);
        }
        return mapAnnouncementsForUser(announcements, currentUser);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    @Override
    public void deleteById(Long id) {
        User currentUser = getCurrentUser();
        Announcement announcement = announcementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono ogłoszenia."));

        String role = normalizeRole(currentUser);
        boolean isAdmin = "ADMIN".equals(role);
        boolean isOwner = Objects.equals(announcement.getAuthor().getId(), currentUser.getId());

        if (!isAdmin && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do usunięcia tego ogłoszenia.");
        }

        if (hasBroadcastKey(announcement) && isAdmin) {
            List<Announcement> broadcastItems = announcementRepository
                    .findByBroadcastKeyOrderByCreatedAtDesc(announcement.getBroadcastKey());
            if (!broadcastItems.isEmpty()) {
                announcementRepository.deleteAll(broadcastItems);
                return;
            }
        }

        announcementRepository.delete(announcement);
    }

    // ── Read Confirmation ──────────────────────────────────────────────────────

    @Override
    public void confirmRead(Long id) {
        User currentUser = getCurrentUser();
        String role = normalizeRole(currentUser);
        if (!"STUDENT".equals(role) && !"STAROSTA".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tylko student lub starosta może potwierdzić przeczytanie ogłoszenia.");
        }

        Announcement announcement = announcementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono ogłoszenia."));

        StudentGroup userGroup = currentUser.getStudentGroup();
        if (userGroup == null || !Objects.equals(userGroup.getId(), announcement.getTargetGroup().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Możesz potwierdzić tylko ogłoszenia przypisane do Twojej grupy.");
        }

        if (Objects.equals(announcement.getAuthor().getId(), currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Nie możesz potwierdzić własnego ogłoszenia.");
        }

        if (readConfirmationRepository.existsByAnnouncement_IdAndReader_Id(announcement.getId(), currentUser.getId())) {
            return;
        }

        AnnouncementReadConfirmation confirmation = new AnnouncementReadConfirmation();
        confirmation.setAnnouncement(announcement);
        confirmation.setReader(currentUser);

        try {
            readConfirmationRepository.save(confirmation);
        } catch (DataIntegrityViolationException ignored) {
        }
    }

    // ── Read Details ───────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<ReadConfirmationDetailDto> getReadDetails(Long id) {
        User currentUser = getCurrentUser();
        Announcement announcement = announcementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono ogłoszenia."));

        String role = normalizeRole(currentUser);
        boolean isAdmin = "ADMIN".equals(role);
        boolean isAuthor = Objects.equals(announcement.getAuthor().getId(), currentUser.getId());

        if (!isAdmin && !isAuthor) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Szczegóły odczytu są dostępne tylko dla autora lub administratora.");
        }

        return readConfirmationRepository
                .findByAnnouncement_IdOrderByConfirmedAtDesc(id)
                .stream()
                .map(c -> new ReadConfirmationDetailDto(
                        c.getReader().getId(),
                        c.getReader().getFirstName(),
                        c.getReader().getLastName(),
                        c.getConfirmedAt()))
                .toList();
    }

    // ── Pin / Unpin ────────────────────────────────────────────────────────────

    @Override
    public AnnouncementResponseDto togglePin(Long id) {
        User currentUser = getCurrentUser();
        Announcement announcement = announcementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono ogłoszenia."));

        String role = normalizeRole(currentUser);
        boolean isAdmin = "ADMIN".equals(role);
        boolean isAuthor = Objects.equals(announcement.getAuthor().getId(), currentUser.getId());

        if (!isAdmin && !isAuthor) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tylko autor ogłoszenia lub administrator może zarządzać przypięciem.");
        }

        boolean newPinnedState = !announcement.isPinned();

        if (hasBroadcastKey(announcement)) {
            announcementRepository.updateIsPinnedByBroadcastKey(announcement.getBroadcastKey(), newPinnedState);
            // Odświeżamy obiekt reprezentatywny, aby zwrócić aktualny stan
            announcement.setPinned(newPinnedState);
        } else {
            announcement.setPinned(newPinnedState);
            announcementRepository.save(announcement);
        }

        return mapAnnouncementsForUser(List.of(announcement), currentUser).get(0);
    }

    // ── Mapowanie ─────────────────────────────────────────────────────────────

    private List<AnnouncementResponseDto> mapAnnouncementsForUser(List<Announcement> announcements, User currentUser) {
        if (announcements.isEmpty())
            return List.of();

        List<Long> announcementIds = announcements.stream().map(Announcement::getId).toList();
        Map<Long, Long> readCountByAnnouncement = fetchReadCounts(announcementIds);

        Set<Long> readByCurrentUser = currentUser.getId() == null
                ? Collections.emptySet()
                : Set.copyOf(readConfirmationRepository
                        .findReadAnnouncementIdsByReaderAndAnnouncementIds(currentUser.getId(), announcementIds));

        String currentRole = normalizeRole(currentUser);
        return announcements.stream()
                .map(a -> mapToDto(a, currentUser, currentRole, readByCurrentUser, readCountByAnnouncement))
                .toList();
    }

    private List<AnnouncementResponseDto> mapAnnouncementsForAdmin(List<Announcement> announcements) {
        if (announcements.isEmpty())
            return List.of();

        List<Long> allIds = announcements.stream().map(Announcement::getId).toList();
        Map<Long, Long> readCountByAnnouncement = fetchReadCounts(allIds);
        Map<String, List<Announcement>> grouped = new LinkedHashMap<>();

        for (Announcement announcement : announcements) {
            String key = hasBroadcastKey(announcement)
                    ? "B:" + announcement.getBroadcastKey()
                    : "S:" + announcement.getId();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(announcement);
        }

        List<AnnouncementResponseDto> result = new ArrayList<>();
        for (List<Announcement> bucket : grouped.values()) {
            Announcement representative = bucket.get(0);
            User author = representative.getAuthor();

            boolean isGlobalBroadcast = hasBroadcastKey(representative);
            String targetGroupName = isGlobalBroadcast
                    ? "Wszyscy (globalnie) - " + bucket.size() + " kierunkow"
                    : representative.getTargetGroup().getName();
            Long targetGroupId = isGlobalBroadcast ? null : representative.getTargetGroup().getId();
            long readCount = bucket.stream()
                    .mapToLong(item -> readCountByAnnouncement.getOrDefault(item.getId(), 0L))
                    .sum();

            result.add(new AnnouncementResponseDto(
                    representative.getId(),
                    representative.getTitle(),
                    representative.getContent(),
                    representative.getCreatedAt(),
                    author.getId(),
                    author.getFirstName(),
                    author.getLastName(),
                    targetGroupId,
                    targetGroupName,
                    true,
                    false,
                    false,
                    true,
                    readCount,
                    representative.getPriority(),
                    representative.isPinned(),
                    isGlobalBroadcast,
                    mapAttachments(representative)));
        }

        return result;
    }

    private AnnouncementResponseDto mapToDto(Announcement announcement,
            User currentUser,
            String currentRole,
            Set<Long> readByCurrentUser,
            Map<Long, Long> readCountByAnnouncement) {
        User author = announcement.getAuthor();
        StudentGroup group = announcement.getTargetGroup();
        boolean isAdmin = "ADMIN".equals(currentRole);
        boolean isAuthor = Objects.equals(author.getId(), currentUser.getId());
        boolean canDelete = isAdmin || isAuthor;
        boolean canConfirmRead = ("STUDENT".equals(currentRole) || "STAROSTA".equals(currentRole))
                && currentUser.getStudentGroup() != null
                && Objects.equals(currentUser.getStudentGroup().getId(), group.getId())
                && !isAuthor
                && !readByCurrentUser.contains(announcement.getId());
        boolean readByUser = readByCurrentUser.contains(announcement.getId());
        long readCount = readCountByAnnouncement.getOrDefault(announcement.getId(), 0L);

        return new AnnouncementResponseDto(
                announcement.getId(),
                announcement.getTitle(),
                announcement.getContent(),
                announcement.getCreatedAt(),
                author.getId(),
                author.getFirstName(),
                author.getLastName(),
                group.getId(),
                group.getName(),
                canDelete,
                canConfirmRead,
                readByUser,
                true,
                readCount,
                announcement.getPriority(),
                announcement.isPinned(),
                hasBroadcastKey(announcement),
                mapAttachments(announcement));
    }

    private List<AttachmentResponseDto> mapAttachments(Announcement announcement) {
        if (announcement.getAttachments() == null || announcement.getAttachments().isEmpty()) {
            return List.of();
        }
        return announcement.getAttachments().stream()
                .map(a -> new AttachmentResponseDto(
                        a.getId(),
                        a.getOriginalFileName(),
                        a.getContentType(),
                        a.getFileSize()))
                .toList();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Announcement buildAnnouncement(AnnouncementCreateDto dto, User author, StudentGroup group,
            String broadcastKey) {
        Announcement announcement = new Announcement();
        announcement.setTitle(dto.title().trim());
        announcement.setContent(dto.content().trim());
        announcement.setAuthor(author);
        announcement.setTargetGroup(group);
        announcement.setBroadcastKey(broadcastKey);
        announcement.setPriority(dto.priority() != null ? dto.priority() : AnnouncementPriority.INFO);
        announcement.setPinned(Boolean.TRUE.equals(dto.isPinned()));
        return announcement;
    }

    private Map<Long, Long> fetchReadCounts(List<Long> announcementIds) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : readConfirmationRepository.countByAnnouncementIds(announcementIds)) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
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

    private void validateStarostaRole(User user) {
        if (!"STAROSTA".equals(normalizeRole(user))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tylko starosta może dodawać ogłoszenia dla swojej grupy.");
        }
    }

    private String normalizeRole(User currentUser) {
        return currentUser.getRole() == null ? "" : currentUser.getRole().toUpperCase().replace("ROLE_", "");
    }

    private boolean hasBroadcastKey(Announcement announcement) {
        return announcement.getBroadcastKey() != null && !announcement.getBroadcastKey().isBlank();
    }

    @Override
    public long countByAuthorId(Long authorId) {
        return announcementRepository.countByAuthor_Id(authorId);
    }

    @Override
    public List<AnnouncementResponseDto> getDashboardFeed(int limit) {
        User currentUser = getCurrentUser();
        String currentRole = normalizeRole(currentUser);
        boolean isAdmin = "ADMIN".equals(currentRole);

        if (isAdmin) {
            List<Announcement> all = announcementRepository.findAllByOrderByIsPinnedDescCreatedAtDesc();
            return mapAnnouncementsForAdmin(all).stream().limit(limit).toList();
        } else {
            StudentGroup group = currentUser.getStudentGroup();
            if (group == null) {
                return List.of();
            }
            List<Announcement> groupAnnouncements = announcementRepository
                    .findByTargetGroup_IdOrderByIsPinnedDescCreatedAtDesc(group.getId());

            Set<Long> readByCurrentUser = readConfirmationRepository.findByReader(currentUser).stream()
                    .map(rc -> rc.getAnnouncement().getId())
                    .collect(Collectors.toSet());

            List<Long> allIds = groupAnnouncements.stream().map(Announcement::getId).toList();
            Map<Long, Long> readCountByAnnouncement = fetchReadCounts(allIds);

            return groupAnnouncements.stream()
                    .limit(limit)
                    .map(a -> mapToDto(a, currentUser, currentRole, readByCurrentUser, readCountByAnnouncement))
                    .toList();
        }
    }
}
