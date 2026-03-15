package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementCreateDto;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementResponseDto;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@Service
@Transactional
public class AnnouncementServiceImpl implements AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final StudentGroupRepository studentGroupRepository;
    private final UserRepository userRepository;

    public AnnouncementServiceImpl(AnnouncementRepository announcementRepository,
                                   StudentGroupRepository studentGroupRepository,
                                   UserRepository userRepository) {
        this.announcementRepository = announcementRepository;
        this.studentGroupRepository = studentGroupRepository;
        this.userRepository = userRepository;
    }

    @Override
    public AnnouncementResponseDto createForOwnGroup(AnnouncementCreateDto dto) {
        User currentUser = getCurrentUser();
        String role = currentUser.getRole() == null ? "" : currentUser.getRole().toUpperCase();

        if ("ADMIN".equals(role)) {
            return createForAdmin(dto, currentUser);
        }

        validateStarostaRole(currentUser);

        StudentGroup group = currentUser.getStudentGroup();
        if (group == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Starosta nie ma przypisanej grupy, więc nie może wysłać ogłoszenia.");
        }

        Announcement saved = announcementRepository.save(buildAnnouncement(dto, currentUser, group));
        return mapToDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AnnouncementResponseDto> getCurrentUserGroupFeed() {
        User currentUser = getCurrentUser();
        StudentGroup group = currentUser.getStudentGroup();

        if (group == null) {
            return List.of();
        }

        return announcementRepository.findByTargetGroup_IdOrderByCreatedAtDesc(group.getId())
                .stream()
                .map(this::mapToDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AnnouncementResponseDto> getAllAnnouncements() {
        return announcementRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::mapToDto)
                .toList();
    }

    @Override
    public void deleteById(Long id) {
        User currentUser = getCurrentUser();
        Announcement announcement = announcementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono ogłoszenia."));

        String role = currentUser.getRole() == null ? "" : currentUser.getRole().toUpperCase();
        boolean isAdmin = "ADMIN".equals(role);
        boolean isOwner = Objects.equals(announcement.getAuthor().getId(), currentUser.getId());

        if (!isAdmin && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak uprawnień do usunięcia tego ogłoszenia.");
        }

        announcementRepository.delete(announcement);

    }

    private AnnouncementResponseDto createForAdmin(AnnouncementCreateDto dto, User adminUser) {
        if (Boolean.TRUE.equals(dto.global())) {
            List<StudentGroup> allGroups = studentGroupRepository.findAll();
            if (allGroups.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Brak grup docelowych. Dodaj kierunki, aby wysłać ogłoszenie globalne.");
            }

            Announcement firstSaved = null;
            for (StudentGroup group : allGroups) {
                Announcement saved = announcementRepository.save(buildAnnouncement(dto, adminUser, group));
                if (firstSaved == null) {
                    firstSaved = saved;
                }
            }
            return mapToDto(firstSaved);
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
            Announcement saved = announcementRepository.save(buildAnnouncement(dto, adminUser, group));
            if (firstSaved == null) {
                firstSaved = saved;
            }
        }

        return mapToDto(firstSaved);
    }

    private Announcement buildAnnouncement(AnnouncementCreateDto dto, User author, StudentGroup group) {
        Announcement announcement = new Announcement();
        announcement.setTitle(dto.title().trim());
        announcement.setContent(dto.content().trim());
        announcement.setAuthor(author);
        announcement.setTargetGroup(group);
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
        if (!"STAROSTA".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tylko starosta może dodawać ogłoszenia dla swojej grupy.");
        }
    }

    private AnnouncementResponseDto mapToDto(Announcement announcement) {
        User author = announcement.getAuthor();
        StudentGroup group = announcement.getTargetGroup();

        return new AnnouncementResponseDto(
                announcement.getId(),
                announcement.getTitle(),
                announcement.getContent(),
                announcement.getCreatedAt(),
                author.getId(),
                author.getFirstName(),
                author.getLastName(),
                group.getId(),
                group.getName());
    }
}
