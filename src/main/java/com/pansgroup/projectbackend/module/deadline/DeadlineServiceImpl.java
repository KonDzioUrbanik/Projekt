package com.pansgroup.projectbackend.module.deadline;

import com.pansgroup.projectbackend.exception.ResourceNotFoundException;
import com.pansgroup.projectbackend.module.deadline.dto.DeadlineCreateDto;
import com.pansgroup.projectbackend.module.deadline.dto.DeadlineResponseDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class DeadlineServiceImpl implements DeadlineService {

    private static final Logger log = LoggerFactory.getLogger(DeadlineServiceImpl.class);

    /** Max terminów GRUPOWYCH, które zwykły student może dodać na dobę. Starosta i Admin są zwolnieni. */
    private static final int DAILY_GROUP_TASK_LIMIT = 10;

    /** Max terminów PRYWATNYCH na dobę — ochrona przed DoS (skrypty w pętli). */
    private static final int DAILY_PRIVATE_TASK_LIMIT = 50;

    /** Odcinamy zadania, których termin minął ponad X dni temu (nie pokazujemy "martwych" terminów). */
    private static final int ARCHIVE_AFTER_DAYS = 3;

    private final DeadlineTaskRepository deadlineRepository;
    private final UserService userService;

    public DeadlineServiceImpl(DeadlineTaskRepository deadlineRepository, UserService userService) {
        this.deadlineRepository = deadlineRepository;
        this.userService = userService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<DeadlineResponseDto> getMyDeadlines(String currentUserEmail) {
        User user = findUser(currentUserEmail);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(ARCHIVE_AFTER_DAYS);

        List<DeadlineTask> tasks;
        if (user.getStudentGroup() != null) {
            tasks = deadlineRepository.findAllForUser(user.getId(), user.getStudentGroup().getId(), cutoff);
        } else {
            tasks = deadlineRepository.findPrivateForUser(user.getId(), cutoff);
        }

        return tasks.stream()
                .map(t -> mapToDto(t, user))
                .toList();
    }

    @Override
    @Transactional
    public DeadlineResponseDto create(DeadlineCreateDto dto, String currentUserEmail) {
        User user = findUser(currentUserEmail);

        // Walidacja daty – max 2 lata w przód (sanity check)
        if (dto.dueDate().isAfter(LocalDateTime.now().plusYears(2))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Data terminu nie może być dalej niż 2 lata od teraz.");
        }

        // Rate limiting dla zadań grupowych (nie dotyczy Starosty i Admina)
        if (dto.visibility() == DeadlineVisibility.GROUP) {
            boolean isPrivileged = "STAROSTA".equalsIgnoreCase(user.getRole())
                    || "ADMIN".equalsIgnoreCase(user.getRole());

            if (!isPrivileged) {
                long countToday = deadlineRepository.countGroupTasksCreatedByUserSince(
                        user.getId(), LocalDateTime.now().minusHours(24));
                if (countToday >= DAILY_GROUP_TASK_LIMIT) {
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                            "Przekroczono dzienny limit (" + DAILY_GROUP_TASK_LIMIT + ") grupowych terminów. Spróbuj jutro.");
                }
            }

            // Użytkownik musi być w grupie, żeby dodawać zadania grupowe
            if (user.getStudentGroup() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Musisz należeć do grupy, aby dodać termin grupowy.");
            }
        }

        // Rate limiting dla zadań prywatnych (wszyscy, łącznie ze Starostą i Adminem)
        if (dto.visibility() == DeadlineVisibility.PRIVATE) {
            long countPrivateToday = deadlineRepository.countPrivateTasksCreatedByUserSince(
                    user.getId(), LocalDateTime.now().minusHours(24));
            if (countPrivateToday >= DAILY_PRIVATE_TASK_LIMIT) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Przekroczono dzienny limit (" + DAILY_PRIVATE_TASK_LIMIT + ") prywatnych terminów. Spróbuj jutro.");
            }
        }

        // Sanityzacja XSS — Jsoup usuwa wszelkie tagi HTML przed zapisem do bazy.
        // Ochrona działa niezależnie od frontendu (defense in depth).
        String safeTitle      = Jsoup.clean(dto.title().trim(),                                     Safelist.none());
        String safeDesc       = dto.description() != null  ? Jsoup.clean(dto.description().trim(),  Safelist.none()) : null;
        String safeCourseName = dto.courseName()  != null  ? Jsoup.clean(dto.courseName().trim(),   Safelist.none()) : null;

        DeadlineTask task = new DeadlineTask();
        task.setTitle(safeTitle);
        task.setDescription(safeDesc);
        task.setCourseName(safeCourseName);
        task.setDueDate(dto.dueDate());
        task.setTaskType(dto.taskType());
        task.setVisibility(dto.visibility());
        task.setAuthor(user);

        if (dto.visibility() == DeadlineVisibility.GROUP) {
            task.setGroup(user.getStudentGroup());
        }

        DeadlineTask saved = deadlineRepository.save(task);
        log.info("[Deadline] New task created: id={}, title='{}', visibility={}, author={}",
                saved.getId(), saved.getTitle(), saved.getVisibility(), currentUserEmail);

        return mapToDto(saved, user);
    }

    @Override
    @Transactional
    public void delete(Long id, String currentUserEmail) {
        User user = findUser(currentUserEmail);
        DeadlineTask task = deadlineRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Termin nie istnieje."));

        boolean isAuthor = task.getAuthor().getId().equals(user.getId());
        boolean isStarostaInSameGroup = "STAROSTA".equalsIgnoreCase(user.getRole())
                && task.getVisibility() == DeadlineVisibility.GROUP
                && user.getStudentGroup() != null
                && user.getStudentGroup().getId().equals(task.getGroup() != null ? task.getGroup().getId() : null);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(user.getRole());

        if (!isAuthor && !isStarostaInSameGroup && !isAdmin) {
            throw new AccessDeniedException("Brak uprawnień do usunięcia tego terminu.");
        }

        deadlineRepository.deleteById(id);
        log.info("[Deadline] Task deleted: id={}, deletedBy={}", id, currentUserEmail);
    }

    // === HELPERS ===

    private User findUser(String email) {
        User user = userService.findUserByEmailInternal(email);
        if (user == null) {
            throw new ResourceNotFoundException("Użytkownik nie istnieje.");
        }
        return user;
    }

    private DeadlineResponseDto mapToDto(DeadlineTask task, User currentUser) {
        boolean isAuthor = task.getAuthor().getId().equals(currentUser.getId());
        boolean isStarostaInSameGroup = "STAROSTA".equalsIgnoreCase(currentUser.getRole())
                && task.getVisibility() == DeadlineVisibility.GROUP
                && currentUser.getStudentGroup() != null
                && currentUser.getStudentGroup().getId().equals(task.getGroup() != null ? task.getGroup().getId() : null);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUser.getRole());
        boolean canEdit = isAuthor || isStarostaInSameGroup || isAdmin;

        return new DeadlineResponseDto(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getCourseName(),
                task.getDueDate(),
                task.getTaskType(),
                task.getVisibility(),
                task.getAuthor().getFirstName() + " " + task.getAuthor().getLastName(),
                task.getAuthor().getId(),
                task.getGroup() != null ? task.getGroup().getName() : null,
                task.getCreatedAt(),
                canEdit
        );
    }
}
