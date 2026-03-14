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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
@SuppressWarnings("null")
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;
    private final StudentGroupRepository studentGroupRepository;

    // Wstrzyknięcie zależności Repozytorium
    public ScheduleServiceImpl(ScheduleRepository scheduleRepository,
            UserRepository userRepository,
            StudentGroupRepository studentGroupRepository) {
        this.scheduleRepository = scheduleRepository;
        this.userRepository = userRepository;
        this.studentGroupRepository = studentGroupRepository;
    }

    @Override
    public ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto) {
        ScheduleEntry entry = toEntity(dto);

        // Przypisanie kierunków jeśli podano
        if (dto.studentGroupIds() != null && !dto.studentGroupIds().isEmpty()) {
            List<StudentGroup> groups = new ArrayList<>();
            for (Long groupId : dto.studentGroupIds()) {
                StudentGroup group = studentGroupRepository.findById(groupId)
                        .orElseThrow(() -> new StudentGroupNotFoundException(groupId));
                groups.add(group);
            }
            entry.setStudentGroups(groups);
        }

        ScheduleEntry saved = scheduleRepository.save(entry);
        return toResponse(saved);
    }

    @Override
    public ScheduleEntryResponseDto update(Long id, ScheduleEntryUpdateDto dto) {
        // Wyszukanie wpisu i rzucenie wyjątku 404, jeśli nie istnieje
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));

        // Aktualizacja wszystkich pól
        entry.setTitle(dto.title().trim());
        entry.setRoom(dto.room().trim());
        entry.setTeacher(dto.teacher().trim());
        entry.setDayOfWeek(dto.dayOfWeek());
        entry.setStartTime(dto.startTime());
        entry.setEndTime(dto.endTime());
        entry.setClassType(dto.classType());
        // Aktualizacja przypisanych kierunków
        if (dto.studentGroupIds() != null) {
            List<StudentGroup> groups = new ArrayList<>();
            for (Long groupId : dto.studentGroupIds()) {
                StudentGroup group = studentGroupRepository.findById(groupId)
                        .orElseThrow(() -> new StudentGroupNotFoundException(groupId));
                groups.add(group);
            }
            entry.setStudentGroups(groups);
        } else {
            entry.setStudentGroups(new ArrayList<>());
        }

        entry.setWeekType(resolvePersistedWeekType(dto.weekType(), dto.customWeeks()));
        entry.setCustomWeeks(normalizeCustomWeeks(dto.customWeeks(), dto.weekType()));

        ScheduleEntry updated = scheduleRepository.save(entry);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        // Wyszukanie i usunięcie wpisu, rzucenie wyjątku 404, jeśli nie istnieje
        if (id == null)
            return;
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        scheduleRepository.delete(entry);
    }

    @Override
    public void deleteByGroupId(Long groupId) {
        if (groupId == null)
            return;

        StudentGroup group = studentGroupRepository.findById(groupId)
                .orElseThrow(() -> new StudentGroupNotFoundException(groupId));

        // Znajdujemy wszystkie zajęcia przypisane do tej grupy
        List<ScheduleEntry> entries = scheduleRepository.findByStudentGroups(group);

        for (ScheduleEntry entry : entries) {
            List<StudentGroup> groups = entry.getStudentGroups();
            if (groups != null) {
                if (groups.size() <= 1) {
                    // Jeśli to jedyna grupa dla tych zajęć -> usuwamy całe zajęcia
                    scheduleRepository.delete(entry);
                } else {
                    // Jeśli jest więcej grup -> tylko odpinamy tę jedną grupę
                    groups.remove(group);
                    scheduleRepository.save(entry);
                }
            }
        }
    }

    @Override
    public ScheduleEntryResponseDto findById(Long id) {
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        return toResponse(entry);
    }

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

        if (candidates.isEmpty()) {
            return 0;
        }

        LocalDateTime archivedAt = LocalDateTime.now();
        candidates.forEach(entry -> {
            entry.setArchived(true);
            entry.setArchivedAt(archivedAt);
        });
        scheduleRepository.saveAll(candidates);
        return candidates.size();
    }

    @Override
    public List<ScheduleEntryResponseDto> findAll() {
        return scheduleRepository.findAll().stream()
                .sorted((s1, s2) -> Long.compare(s1.getId(), s2.getId())) // sortowanie po id rosnaco
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
        } else {
            // Wyszukanie zajęć po relacji z grupą studencką
            return scheduleRepository.findByStudentGroups(group)
                    .stream()
                    .filter(entry -> !Boolean.TRUE.equals(entry.getArchived()))
                    .map(this::toResponse)
                    .toList();
        }
    }

    // ---------- METODY POMOCNICZE (Konwersja) ----------

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
                entry.getArchivedAt());
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
        entry.setArchived(false);
        entry.setArchivedAt(null);
        // studentGroups są ustawiane w metodzie create
        return entry;
    }

    private String normalizeCustomWeeks(String customWeeks, WeekType weekType) {
        if (weekType != WeekType.CUSTOM) {
            return null;
        }
        if (customWeeks == null || customWeeks.isBlank()) {
            throw new IllegalArgumentException("Dla trybu niestandardowego podaj numery tygodni (np. 1,3,5).");
        }

        List<Integer> weeks = Arrays.stream(customWeeks.split(","))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .map(token -> {
                    if (!token.matches("\\d{1,2}")) {
                        throw new IllegalArgumentException(
                                "Niepoprawny format numeru tygodnia: '" + token + "'. Użyj liczb 1-53 oddzielonych przecinkami.");
                    }
                    int weekNumber = Integer.parseInt(token);
                    if (weekNumber < 1 || weekNumber > 53) {
                        throw new IllegalArgumentException(
                                "Numer tygodnia poza zakresem 1-53: " + weekNumber + ".");
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
        // Część środowisk ma w DB constraint/enum tylko ALL/WEEK_A/WEEK_B.
        // Dla trybu niestandardowego zapisujemy ALL + customWeeks.
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