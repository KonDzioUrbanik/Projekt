package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementCreateDto;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementResponseDto;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class AnnouncementServiceImpl implements AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final AnnouncementReadConfirmationRepository readConfirmationRepository;
    private final StudentGroupRepository studentGroupRepository;
    private final UserRepository userRepository;

    public AnnouncementServiceImpl(AnnouncementRepository announcementRepository,
                                   AnnouncementReadConfirmationRepository readConfirmationRepository,
                                   StudentGroupRepository studentGroupRepository,
                                   UserRepository userRepository) {
        this.announcementRepository = announcementRepository;
        this.readConfirmationRepository = readConfirmationRepository;
        this.studentGroupRepository = studentGroupRepository;
        this.userRepository = userRepository;
    }

    @Override
    public AnnouncementResponseDto createForOwnGroup(AnnouncementCreateDto dto) {
        User currentUser = getCurrentUser();
        String role = normalizeRole(currentUser);

        if ("ADMIN".equals(role)) {
            return createForAdmin(dto, currentUser);
        }

        validateStarostaRole(currentUser);

        StudentGroup group = currentUser.getStudentGroup();
        if (group == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Starosta nie ma przypisanej grupy, więc nie może wysłać ogłoszenia.");
        }

        Announcement saved = announcementRepository.save(buildAnnouncement(dto, currentUser, group, null));
        return mapAnnouncementsForUser(List.of(saved), currentUser).get(0);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AnnouncementResponseDto> getCurrentUserGroupFeed() {
        User currentUser = getCurrentUser();
        StudentGroup group = currentUser.getStudentGroup();

        if (group == null) {
            return List.of();
        }

        List<Announcement> announcements = announcementRepository.findByTargetGroup_IdOrderByCreatedAtDesc(group.getId());
        return mapAnnouncementsForUser(announcements, currentUser);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AnnouncementResponseDto> getAllAnnouncements() {
        User currentUser = getCurrentUser();
        List<Announcement> announcements = announcementRepository.findAllByOrderByCreatedAtDesc();
        if ("ADMIN".equals(normalizeRole(currentUser))) {
            return mapAnnouncementsForAdmin(announcements);
        }
        return mapAnnouncementsForUser(announcements, currentUser);
    }

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
            // Równoległe kliknięcia traktujemy idempotentnie.
        }
    }

    private AnnouncementResponseDto createForAdmin(AnnouncementCreateDto dto, User adminUser) {
        if (Boolean.TRUE.equals(dto.global())) {
            List<StudentGroup> allGroups = studentGroupRepository.findAll();
            if (allGroups.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Brak grup docelowych. Dodaj kierunki, aby wysłać ogłoszenie globalne.");
            }

            String broadcastKey = "GLOBAL-" + UUID.randomUUID();
            Announcement firstSaved = null;
            for (StudentGroup group : allGroups) {
                Announcement saved = announcementRepository.save(buildAnnouncement(dto, adminUser, group, broadcastKey));
                if (firstSaved == null) {
                    firstSaved = saved;
                }
            }
            return mapAnnouncementsForUser(List.of(firstSaved), adminUser).get(0);
        }

        List<Long> groupIds = dto.targetGroupIds() == null ? List.of() : dto.targetGroupIds().stream().distinct().toList();
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
            if (firstSaved == null) {
                firstSaved = saved;
            }
        }

        return mapAnnouncementsForUser(List.of(firstSaved), adminUser).get(0);
    }

    private Announcement buildAnnouncement(AnnouncementCreateDto dto, User author, StudentGroup group, String broadcastKey) {
        Announcement announcement = new Announcement();
        announcement.setTitle(dto.title().trim());
        announcement.setContent(dto.content().trim());
        announcement.setAuthor(author);
        announcement.setTargetGroup(group);
        announcement.setBroadcastKey(broadcastKey);
        return announcement;
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

    private List<AnnouncementResponseDto> mapAnnouncementsForUser(List<Announcement> announcements, User currentUser) {
        if (announcements.isEmpty()) {
            return List.of();
        }

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
        if (announcements.isEmpty()) {
            return List.of();
        }

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
                    readCount
            ));
        }

        return result;
    }

    private Map<Long, Long> fetchReadCounts(List<Long> announcementIds) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : readConfirmationRepository.countByAnnouncementIds(announcementIds)) {
            Long announcementId = (Long) row[0];
            Long count = (Long) row[1];
            counts.put(announcementId, count);
        }
        return counts;
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
        boolean canViewReadStats = true;
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
                canViewReadStats,
                readCount);
    }

    private String normalizeRole(User currentUser) {
        return currentUser.getRole() == null ? "" : currentUser.getRole().toUpperCase().replace("ROLE_", "");
    }

    private boolean hasBroadcastKey(Announcement announcement) {
        return announcement.getBroadcastKey() != null && !announcement.getBroadcastKey().isBlank();
    }
}
