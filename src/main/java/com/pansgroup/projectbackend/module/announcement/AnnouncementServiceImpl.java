package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementCreateDto;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementResponseDto;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional
public class AnnouncementServiceImpl implements AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final UserRepository userRepository;

    public AnnouncementServiceImpl(AnnouncementRepository announcementRepository, UserRepository userRepository) {
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
    }

    @Override
    public AnnouncementResponseDto createForOwnGroup(AnnouncementCreateDto dto) {
        User currentUser = getCurrentUser();
        validateStarostaRole(currentUser);

        StudentGroup group = currentUser.getStudentGroup();
        if (group == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Starosta nie ma przypisanej grupy, więc nie może wysłać ogłoszenia.");
        }

        Announcement announcement = new Announcement();
        announcement.setTitle(dto.title().trim());
        announcement.setContent(dto.content().trim());
        announcement.setAuthor(currentUser);
        announcement.setTargetGroup(group);

        Announcement saved = announcementRepository.save(announcement);
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
