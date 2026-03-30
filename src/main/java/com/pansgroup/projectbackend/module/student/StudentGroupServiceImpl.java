package com.pansgroup.projectbackend.module.student;

import com.pansgroup.projectbackend.exception.StudentGroupAlreadyExistsException;
import com.pansgroup.projectbackend.exception.StudentGroupInUseException;
import com.pansgroup.projectbackend.exception.StudentGroupNotFoundException;
import com.pansgroup.projectbackend.module.announcement.Announcement;
import com.pansgroup.projectbackend.module.announcement.AnnouncementRepository;
import com.pansgroup.projectbackend.module.schedule.ScheduleEntry;
import com.pansgroup.projectbackend.module.schedule.ScheduleRepository;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupCreateDto;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import com.pansgroup.projectbackend.module.user.UserService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class StudentGroupServiceImpl implements StudentGroupService {
    private final StudentGroupRepository studentGroupRepository;
    private final UserService userService;
    private final UserRepository userRepository;
    private final AnnouncementRepository announcementRepository;
    private final ScheduleRepository scheduleRepository;

    public StudentGroupServiceImpl(StudentGroupRepository studentGroupRepository, 
                                 UserService userService,
                                 UserRepository userRepository,
                                 AnnouncementRepository announcementRepository,
                                 ScheduleRepository scheduleRepository) {
        this.studentGroupRepository = studentGroupRepository;
        this.userService = userService;
        this.userRepository = userRepository;
        this.announcementRepository = announcementRepository;
        this.scheduleRepository = scheduleRepository;
    }

    //Metody pomocnicza
    private StudentGroupResponseDto toResponse(StudentGroup entity) {
        return new StudentGroupResponseDto(
                entity.getId(),
                entity.getName()
        );
    }

    private StudentGroup toEntity(StudentGroupCreateDto dto) {
        StudentGroup entry = new StudentGroup();
        entry.setName(normalizeName(dto.name()));
        return entry;
    }

    private String normalizeName(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ");
    }

    private void ensureUniqueName(String name, Long currentId) {
        String normalizedName = normalizeName(name);
        boolean exists = studentGroupRepository.findAll().stream()
                .anyMatch(group -> !group.getId().equals(currentId)
                        && normalizeName(group.getName()).toLowerCase(Locale.ROOT)
                                .equals(normalizedName.toLowerCase(Locale.ROOT)));

        if (exists) {
            throw new StudentGroupAlreadyExistsException(
                    "Kierunek o nazwie '" + normalizedName + "' już istnieje.");
        }
    }


    @Override
    public StudentGroupResponseDto create(StudentGroupCreateDto dto) {
        ensureUniqueName(dto.name(), null);
        StudentGroup entry = toEntity(dto);
        StudentGroup saved = studentGroupRepository.save(entry);
        return toResponse(saved);
    }

    @Override
    public StudentGroupResponseDto findById(Long id) {
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (isAdmin) {
            StudentGroup entity = studentGroupRepository.findById(id)
                    .orElseThrow(() -> new StudentGroupNotFoundException(">" + id + "<"));
            return toResponse(entity);
        }
        String userEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userService.findUserByEmailInternal(userEmail);

        if (currentUser.getStudentGroup() != null && currentUser.getStudentGroup().getId().equals(id)) {
            throw new StudentGroupNotFoundException("Nie masz uprawnień do modyfikacji tego kierunku.");
        }


        StudentGroup entity = studentGroupRepository.findById(id)
                .orElseThrow(() ->
                    new StudentGroupNotFoundException(">" + id + "<"));
        return toResponse(entity);
    }

    @Override
    public List<StudentGroupResponseDto> findAll() {
        return studentGroupRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public StudentGroupResponseDto update(Long id, StudentGroupCreateDto dto) {
        StudentGroup entity = studentGroupRepository.findById(id)
                .orElseThrow(() -> new StudentGroupNotFoundException(">" + id + "<"));
        ensureUniqueName(dto.name(), id);
        entity.setName(normalizeName(dto.name()));
        StudentGroup updated = studentGroupRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        StudentGroup entity = studentGroupRepository.findById(id)
                .orElseThrow(() -> new StudentGroupNotFoundException(">" + id + "<"));

        // 1. Pre-check for users: We DO NOT delete users automatically
        long userCount = userRepository.countByStudentGroup(entity);
        if (userCount > 0) {
            throw new StudentGroupInUseException(
                "Nie można usunąć kierunku '" + entity.getName() + "', ponieważ jest do niego przypisanych " + userCount + " użytkowników. Przenieś ich najpierw do innej grupy.");
        }

        // 2. Cascade delete announcements: These are safe to delete
        List<Announcement> announcements = announcementRepository.findByTargetGroup(entity);
        announcementRepository.deleteAll(announcements);

        // 3. Remove associations from schedule (ManyToMany)
        List<ScheduleEntry> entries = scheduleRepository.findByStudentGroups(entity);
        for (ScheduleEntry entry : entries) {
            entry.getStudentGroups().remove(entity);
            scheduleRepository.save(entry);
        }

        // 4. Finally delete the group
        studentGroupRepository.delete(entity);
    }
}
