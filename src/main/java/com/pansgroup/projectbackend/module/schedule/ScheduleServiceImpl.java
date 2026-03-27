package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.exception.ScheduleEntryNotFoundException;
import com.pansgroup.projectbackend.exception.StudentGroupNotFoundException;
import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryResponseDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryUpdateDto;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@SuppressWarnings("null")
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;
    private final StudentGroupRepository studentGroupRepository;

    public ScheduleServiceImpl(ScheduleRepository scheduleRepository,
            UserRepository userRepository,
            StudentGroupRepository studentGroupRepository) {
        this.scheduleRepository = scheduleRepository;
        this.userRepository = userRepository;
        this.studentGroupRepository = studentGroupRepository;
    }

    // ── Create ──────────────────────────────────────────────────────────────────

    @Override
    public ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto) {
        return create(dto, false);
    }

    @Override
    public ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto, boolean force) {
        ScheduleEntry entry = toEntity(dto);

        if (dto.studentGroupIds() != null && !dto.studentGroupIds().isEmpty()) {
            List<StudentGroup> groups = resolveGroups(dto.studentGroupIds());
            entry.setStudentGroups(groups);
        }

        if (entry.getStartTime() != null && entry.getEndTime() != null && !entry.getEndTime().isAfter(entry.getStartTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Godzina zakończenia musi być późniejsza niż godzina rozpoczęcia.");
        }

        if (!force) {
            List<String> collisionWarnings = detectCollisions(entry, null);
            if (!collisionWarnings.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Wykryto kolizję: " + String.join("; ", collisionWarnings));
            }
        }

        ScheduleEntry saved = scheduleRepository.save(entry);
        return toResponse(saved);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    @Override
    public ScheduleEntryResponseDto update(Long id, ScheduleEntryUpdateDto dto) {
        return update(id, dto, false);
    }

    @Override
    public ScheduleEntryResponseDto update(Long id, ScheduleEntryUpdateDto dto, boolean force) {
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));

        // Weryfikacja uprawnień Starosty – może edytować tylko zajęcia swojej grupy
        checkStarostaPermission(entry);

        entry.setTitle(dto.title().trim());
        entry.setRoom(dto.room().trim());
        entry.setTeacher(dto.teacher().trim());
        entry.setDayOfWeek(dto.dayOfWeek());
        entry.setStartTime(dto.startTime());
        entry.setEndTime(dto.endTime());
        entry.setClassType(dto.classType());
        entry.setGroupNumber(dto.groupNumber());
        entry.setSpecialization(dto.specialization());

        if (dto.studentGroupIds() != null) {
            entry.setStudentGroups(resolveGroups(dto.studentGroupIds()));
        } else {
            entry.setStudentGroups(new ArrayList<>());
        }

        entry.setWeekType(resolvePersistedWeekType(dto.weekType(), dto.customWeeks()));
        entry.setCustomWeeks(normalizeCustomWeeks(dto.customWeeks(), dto.weekType()));

        if (entry.getStartTime() != null && entry.getEndTime() != null && !entry.getEndTime().isAfter(entry.getStartTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Godzina zakończenia musi być późniejsza niż godzina rozpoczęcia.");
        }

        if (!force) {
            List<String> collisionWarnings = detectCollisions(entry, id);
            if (!collisionWarnings.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Wykryto kolizję: " + String.join("; ", collisionWarnings));
            }
        }

        ScheduleEntry updated = scheduleRepository.save(entry);
        return toResponse(updated);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    @Override
    public void delete(Long id) {
        if (id == null)
            return;
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        checkStarostaPermission(entry);
        scheduleRepository.delete(entry);
    }

    @Override
    public void deleteByGroupId(Long groupId) {
        if (groupId == null)
            return;

        StudentGroup group = studentGroupRepository.findById(groupId)
                .orElseThrow(() -> new StudentGroupNotFoundException(groupId));

        List<ScheduleEntry> entries = scheduleRepository.findByStudentGroups(group);

        for (ScheduleEntry entry : entries) {
            List<StudentGroup> groups = entry.getStudentGroups();
            if (groups != null) {
                if (groups.size() <= 1) {
                    scheduleRepository.delete(entry);
                } else {
                    groups.remove(group);
                    scheduleRepository.save(entry);
                }
            }
        }
    }

    // ── Find ───────────────────────────────────────────────────────────────────

    @Override
    public ScheduleEntryResponseDto findById(Long id) {
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        return toResponse(entry);
    }

    @Override
    public List<ScheduleEntryResponseDto> findAll() {
        return scheduleRepository.findAll().stream()
                .sorted((s1, s2) -> Long.compare(s1.getId(), s2.getId()))
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<ScheduleEntryResponseDto> getMySchedule(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Nie ma takiego Użytkownika: " + userEmail));
        StudentGroup group = user.getStudentGroup();
        if (group == null) {
            return Collections.emptyList();
        }
        return scheduleRepository.findByStudentGroups(group)
                .stream()
                .filter(entry -> !Boolean.TRUE.equals(entry.getArchived()))
                .map(this::toResponse)
                .toList();
    }

    // ── Archive ────────────────────────────────────────────────────────────────

    @Override
    public ScheduleEntryResponseDto archive(Long id) {
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        entry.setArchived(true);
        entry.setArchivedAt(LocalDateTime.now());
        return toResponse(scheduleRepository.save(entry));
    }

    @Override
    public ScheduleEntryResponseDto restore(Long id) {
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        entry.setArchived(false);
        entry.setArchivedAt(null);
        return toResponse(scheduleRepository.save(entry));
    }

    @Override
    public int archiveActive(String yearPlan) {
        List<ScheduleEntry> candidates = scheduleRepository.findAll().stream()
                .filter(entry -> !Boolean.TRUE.equals(entry.getArchived()))
                .filter(entry -> yearPlan == null || yearPlan.isBlank()
                        || (entry.getYearPlan() != null && entry.getYearPlan().equalsIgnoreCase(yearPlan.trim())))
                .toList();

        if (candidates.isEmpty())
            return 0;

        LocalDateTime archivedAt = LocalDateTime.now();
        candidates.forEach(entry -> {
            entry.setArchived(true);
            entry.setArchivedAt(archivedAt);
        });
        scheduleRepository.saveAll(candidates);
        return candidates.size();
    }

    // Collision Detection

    /* Wykrywa kolizje sali, prowadzącego i grupy dla danego entry */
    private List<String> detectCollisions(ScheduleEntry entry, Long excludeId) {
        if (entry.getDayOfWeek() == null || entry.getStartTime() == null || entry.getEndTime() == null) {
            return List.of();
        }

        List<String> warnings = new ArrayList<>();

        // Pobierz wszystkie niearchiwalne zajęcia do porównania
        List<ScheduleEntry> candidates = scheduleRepository.findAll().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getArchived()))
                .filter(e -> excludeId == null || !e.getId().equals(excludeId))
                .filter(e -> entry.getDayOfWeek() == e.getDayOfWeek())
                .filter(e -> timesOverlap(entry, e))
                .toList();

        for (ScheduleEntry c : candidates) {
            if (weekTypesConflict(entry, c)) {
                boolean roomConflict = entry.getRoom() != null && !entry.getRoom().isBlank()
                        && !entry.getRoom().equalsIgnoreCase("zdalnie")
                        && !entry.getRoom().equalsIgnoreCase("online")
                        && entry.getRoom().equalsIgnoreCase(c.getRoom());

                boolean teacherConflict = entry.getTeacher() != null && !entry.getTeacher().isBlank()
                        && entry.getTeacher().equalsIgnoreCase(c.getTeacher());

                boolean groupConflict = false;
                if (haveCommonGroups(entry, c)) {
                    // Konflikt grupy występuje tylko jeśli są te same podgrupy (numer grupy i
                    // specjalizacja)
                    boolean sameGroupNum = Objects.equals(entry.getGroupNumber(), c.getGroupNumber());
                    boolean sameSpec = Objects.equals(entry.getSpecialization(), c.getSpecialization());
                    if (sameGroupNum && sameSpec) {
                        groupConflict = true;
                    }
                }

                if (roomConflict || teacherConflict || groupConflict) {
                    String reason = roomConflict ? "sala " + c.getRoom()
                            : (teacherConflict ? "wykładowca " + c.getTeacher() : "grupa studencka");

                    warnings.add("Kolizja (" + reason + ") z '" + c.getTitle() + "' ("
                            + c.getStartTime().toString().substring(0, 5) + "-"
                            + c.getEndTime().toString().substring(0, 5) + ")");
                }
            }
        }

        return warnings;
    }

    private boolean haveCommonGroups(ScheduleEntry a, ScheduleEntry b) {
        if (a.getStudentGroups() == null || b.getStudentGroups() == null)
            return false;
        Set<Long> aIds = a.getStudentGroups().stream().map(StudentGroup::getId).collect(Collectors.toSet());
        return b.getStudentGroups().stream().anyMatch(g -> aIds.contains(g.getId()));
    }

    private boolean timesOverlap(ScheduleEntry a, ScheduleEntry b) {
        return a.getStartTime().isBefore(b.getEndTime())
                && b.getStartTime().isBefore(a.getEndTime());
    }

    private boolean weekTypesConflict(ScheduleEntry a, ScheduleEntry b) {
        // A i B nie kolidują
        if (a.getWeekType() == WeekType.WEEK_A && b.getWeekType() == WeekType.WEEK_B)
            return false;
        if (a.getWeekType() == WeekType.WEEK_B && b.getWeekType() == WeekType.WEEK_A)
            return false;

        // CUSTOM vs CUSTOM – sprawdź wspólne tygodnie
        if (a.getWeekType() == WeekType.ALL && b.getWeekType() == WeekType.ALL) {
            String aCustom = a.getCustomWeeks();
            String bCustom = b.getCustomWeeks();
            if (aCustom != null && !aCustom.isBlank() && bCustom != null && !bCustom.isBlank()) {
                return haveCommonWeeks(aCustom, bCustom);
            }
        }

        // Wszystkie pozostałe kombinacje (ALL+ALL, ALL+A, ALL+B, etc.) kolidują
        return true;
    }

    private boolean haveCommonWeeks(String a, String b) {
        Set<String> aWeeks = new HashSet<>(Arrays.asList(a.split(",")));
        return Arrays.stream(b.split(",")).anyMatch(aWeeks::contains);
    }

    // ── Starosta Permission Check ──────────────────────────────────────────────

    /**
     * Weryfikuje uprawnienia Starosty: może modyfikować tylko zajęcia przypisane do
     * jego grupy.
     * Administratorzy i pozostałe role nie podlegają tej weryfikacji.
     */
    private void checkStarostaPermission(ScheduleEntry entry) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated())
            return;

        boolean isStarosta = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_STAROSTA"));
        if (!isStarosta)
            return;

        String email = auth.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Użytkownik nie znaleziony: " + email));

        StudentGroup starostaGroup = user.getStudentGroup();
        if (starostaGroup == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Starosta nie ma przypisanej grupy.");
        }

        boolean hasAccess = entry.getStudentGroups() != null
                && entry.getStudentGroups().stream()
                        .anyMatch(g -> g.getId().equals(starostaGroup.getId()));

        if (!hasAccess) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Starosta może edytować tylko zajęcia swojego kierunku.");
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private ScheduleEntryResponseDto toResponse(ScheduleEntry entry) {
        List<StudentGroupResponseDto> groupDtos = entry.getStudentGroups() != null
                ? entry.getStudentGroups().stream()
                        .map(g -> new StudentGroupResponseDto(g.getId(), g.getName()))
                        .toList()
                : Collections.emptyList();

        return new ScheduleEntryResponseDto(
                entry.getId(),
                entry.getTitle(),
                entry.getRoom(),
                entry.getTeacher(),
                entry.getDayOfWeek(),
                entry.getStartTime(),
                entry.getEndTime(),
                entry.getClassType(),
                groupDtos,
                resolveResponseWeekType(entry),
                entry.getCustomWeeks(),
                entry.getArchived(),
                entry.getArchivedAt(),
                entry.getGroupNumber(),
                entry.getSpecialization());
    }

    private ScheduleEntry toEntity(ScheduleEntryCreateDto dto) {
        ScheduleEntry entry = new ScheduleEntry();
        entry.setTitle(dto.title().trim());
        entry.setRoom(dto.room().trim());
        entry.setTeacher(dto.teacher().trim());
        entry.setDayOfWeek(dto.dayOfWeek());
        entry.setStartTime(dto.startTime());
        entry.setEndTime(dto.endTime());
        entry.setClassType(dto.classType());
        entry.setWeekType(resolvePersistedWeekType(dto.weekType(), dto.customWeeks()));
        entry.setCustomWeeks(normalizeCustomWeeks(dto.customWeeks(), dto.weekType()));
        entry.setGroupNumber(dto.groupNumber());
        entry.setSpecialization(dto.specialization());
        entry.setArchived(false);
        entry.setArchivedAt(null);
        return entry;
    }

    private List<StudentGroup> resolveGroups(List<Long> groupIds) {
        List<StudentGroup> groups = new ArrayList<>();
        for (Long groupId : groupIds) {
            StudentGroup group = studentGroupRepository.findById(groupId)
                    .orElseThrow(() -> new StudentGroupNotFoundException(groupId));
            groups.add(group);
        }
        return groups;
    }

    private String normalizeCustomWeeks(String customWeeks, WeekType weekType) {
        if (weekType != WeekType.CUSTOM)
            return null;
        if (customWeeks == null || customWeeks.isBlank()) {
            throw new IllegalArgumentException("Dla trybu niestandardowego podaj numery tygodni (np. 1,3,5).");
        }

        List<Integer> weeks = Arrays.stream(customWeeks.split(","))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .map(token -> {
                    if (!token.matches("\\d{1,2}")) {
                        throw new IllegalArgumentException(
                                "Niepoprawny format numeru tygodnia: '" + token + "'. Użyj liczb 1-53.");
                    }
                    int weekNumber = Integer.parseInt(token);
                    if (weekNumber < 1 || weekNumber > 53) {
                        throw new IllegalArgumentException("Numer tygodnia poza zakresem 1-53: " + weekNumber);
                    }
                    return weekNumber;
                })
                .distinct()
                .toList();

        if (weeks.isEmpty()) {
            throw new IllegalArgumentException("Nie podano żadnego poprawnego numeru tygodnia.");
        }

        return weeks.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private WeekType resolvePersistedWeekType(WeekType requestWeekType, String customWeeks) {
        if (requestWeekType == WeekType.CUSTOM && customWeeks != null) {
            return WeekType.ALL;
        }
        return requestWeekType;
    }

    private WeekType resolveResponseWeekType(ScheduleEntry entry) {
        if (entry.getCustomWeeks() != null && !entry.getCustomWeeks().isBlank()) {
            return WeekType.CUSTOM;
        }
        return entry.getWeekType();
    }
}