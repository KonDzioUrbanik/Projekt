package com.pansgroup.projectbackend.module.schedule;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pansgroup.projectbackend.exception.ScheduleEntryNotFoundException;
import com.pansgroup.projectbackend.exception.StudentGroupNotFoundException;
import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryResponseDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryUpdateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleOccurrenceDto;
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
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@SuppressWarnings("null")
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;
    private final StudentGroupRepository studentGroupRepository;
    private final ObjectMapper objectMapper;

    public ScheduleServiceImpl(ScheduleRepository scheduleRepository,
            UserRepository userRepository,
            StudentGroupRepository studentGroupRepository,
            ObjectMapper objectMapper) {
        this.scheduleRepository = scheduleRepository;
        this.userRepository = userRepository;
        this.studentGroupRepository = studentGroupRepository;
        this.objectMapper = objectMapper;
    }

    // Create

    @Override
    public ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto) {
        return create(dto, false);
    }

    @Override
    public ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto, boolean force) {
        // Starosta permission check for create
        checkStarostaCreatePermission(dto);

        ScheduleEntry entry = toEntity(dto);

        if (dto.studentGroupIds() != null && !dto.studentGroupIds().isEmpty()) {
            entry.setStudentGroups(resolveGroups(dto.studentGroupIds()));
        }

        validateOccurrenceTimes(dto.occurrences());

        if (force) {
            checkStarostaForceCollisionPermission(entry, dto.occurrences(), null, 
                    serializeTeachers(dto.teachers()), resolveGroups(dto.studentGroupIds()));
        } else {
            List<String> collisionWarnings = detectCollisions(entry, dto.occurrences(), null, 
                    serializeTeachers(dto.teachers()), resolveGroups(dto.studentGroupIds()));
            if (!collisionWarnings.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Wykryto kolizję: " + String.join("; ", collisionWarnings));
            }
        }

        if (dto.occurrences() != null) {
            for (ScheduleOccurrenceDto occDto : dto.occurrences()) {
                ScheduleOccurrence occ = new ScheduleOccurrence();
                occ.setEntry(entry);
                occ.setStartDateTime(occDto.startDateTime());
                occ.setEndDateTime(occDto.endDateTime());
                occ.setRoom(occDto.room());
                occ.setBuildingCode(occDto.buildingCode());
                occ.setLocation(occDto.location());
                entry.getOccurrences().add(occ);
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

        checkStarostaPermission(entry);

        validateOccurrenceTimes(dto.occurrences());

        // Perform collision detection BEFORE modifying the persistent entity 
        // to avoid premature flushes of dirty state (which can cause DataIntegrityViolationException)
        if (force) {
            checkStarostaForceCollisionPermission(entry, dto.occurrences(), id, 
                    serializeTeachers(dto.teachers()), resolveGroups(dto.studentGroupIds()));
        } else {
            List<String> collisionWarnings = detectCollisions(entry, dto.occurrences(), id, 
                    serializeTeachers(dto.teachers()), resolveGroups(dto.studentGroupIds()));
            if (!collisionWarnings.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Wykryto kolizję: " + String.join("; ", collisionWarnings));
            }
        }

        // Now safe to modify the entity
        entry.setTitle(dto.title().trim());
        entry.setTeachers(serializeTeachers(dto.teachers()));
        entry.setClassType(dto.classType());
        entry.setCreditType(dto.creditType());
        entry.setGroupNumber(dto.groupNumber());
        entry.setSpecialization(dto.specialization());
        entry.setYearPlan(dto.yearPlan());

        if (dto.studentGroupIds() != null) {
            entry.setStudentGroups(resolveGroups(dto.studentGroupIds()));
        } else {
            entry.setStudentGroups(new HashSet<>());
        }

        // Properly sync occurrences using child collection management
        entry.getOccurrences().clear();
        if (dto.occurrences() != null) {
            for (ScheduleOccurrenceDto occDto : dto.occurrences()) {
                ScheduleOccurrence occ = new ScheduleOccurrence();
                occ.setEntry(entry);
                occ.setStartDateTime(occDto.startDateTime());
                occ.setEndDateTime(occDto.endDateTime());
                occ.setRoom(occDto.room());
                occ.setBuildingCode(occDto.buildingCode());
                occ.setLocation(occDto.location());
                entry.getOccurrences().add(occ);
            }
        }

        ScheduleEntry updated = scheduleRepository.save(entry);
        return toResponse(updated);
    }

    // Delete

    @Override
    public void delete(Long id) {
        if (id == null)
            return;
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        checkStarostaPermission(entry);
        // Occurrences deleted by cascade
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
            Set<StudentGroup> groups = entry.getStudentGroups();
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

    // Find

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
    public List<ScheduleEntryResponseDto> findAllForStarosta(String starostaEmail) {
        User starosta = userRepository.findByEmail(starostaEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Nie ma takiego Użytkownika: " + starostaEmail));

        StudentGroup group = starosta.getStudentGroup();
        if (group == null) {
            return Collections.emptyList();
        }

        return scheduleRepository.findByStudentGroups(group).stream()
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

    // Archive

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

    /**
     * Wykrywa kolizje sal i prowadzących na podstawie konkretnych terminów.
     * Dla kolidujących terminów sprawdza nachodzenie przedziałów czasowych.
     */
    private List<String> detectCollisions(ScheduleEntry entry,
            List<ScheduleOccurrenceDto> newOccurrences,
            Long excludeId,
            String newTeachersJson,
            Set<StudentGroup> newGroups) {
        if (newOccurrences == null || newOccurrences.isEmpty())
            return List.of();

        List<String> warnings = new ArrayList<>();
        List<ScheduleEntry> collidingEntries = findCollidingEntries(entry, newOccurrences, excludeId, newTeachersJson, newGroups);

        for (ScheduleEntry candidate : collidingEntries) {
            // Find which specific occurrences collide to provide better warning
            for (ScheduleOccurrenceDto newOcc : newOccurrences) {
                for (ScheduleOccurrence existingOcc : candidate.getOccurrences()) {
                    if (dateTimeRangesOverlap(newOcc.startDateTime(), newOcc.endDateTime(),
                            existingOcc.getStartDateTime(), existingOcc.getEndDateTime())) {

                        // Room collision
                        if (newOcc.room() != null && !newOcc.room().isBlank()
                                && existingOcc.getRoom() != null
                                && newOcc.room().equalsIgnoreCase(existingOcc.getRoom())
                                && nullableEqual(newOcc.buildingCode(), existingOcc.getBuildingCode())) {
                            warnings.add("Kolizja sali " + newOcc.room()
                                    + " z '" + candidate.getTitle() + "' ("
                                    + formatDt(existingOcc.getStartDateTime()) + ")");
                        }

                        // Teacher collision
                        List<String> newTeachersArr = deserializeTeachers(newTeachersJson != null ? newTeachersJson : entry.getTeachers());
                        List<String> existingTeachers = deserializeTeachers(candidate.getTeachers());
                        List<String> overlappingTeachers = newTeachersArr.stream()
                                .filter(t -> existingTeachers.stream().anyMatch(t::equalsIgnoreCase))
                                .toList();
                        if (!overlappingTeachers.isEmpty() && haveCommonGroups(newGroups != null ? newGroups : entry.getStudentGroups(), candidate.getStudentGroups())) {
                            warnings.add("Kolizja prowadzącego " + overlappingTeachers.get(0)
                                    + " z '" + candidate.getTitle() + "' ("
                                    + formatDt(existingOcc.getStartDateTime()) + ")");
                        }
                    }
                }
            }
        }
        return warnings.stream().distinct().toList();
    }

    private List<ScheduleEntry> findCollidingEntries(ScheduleEntry entry,
            List<ScheduleOccurrenceDto> newOccurrences,
            Long excludeId,
            String newTeachersJson,
            Set<StudentGroup> newGroups) {
        if (newOccurrences == null || newOccurrences.isEmpty())
            return List.of();

        List<ScheduleEntry> colliding = new ArrayList<>();
        List<ScheduleEntry> candidates = scheduleRepository.findAll().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getArchived()))
                .filter(e -> excludeId == null || !e.getId().equals(excludeId))
                .toList();

        for (ScheduleOccurrenceDto newOcc : newOccurrences) {
            for (ScheduleEntry candidate : candidates) {
                if (candidate.getOccurrences() == null)
                    continue;

                for (ScheduleOccurrence existingOcc : candidate.getOccurrences()) {
                    if (!dateTimeRangesOverlap(
                            newOcc.startDateTime(), newOcc.endDateTime(),
                            existingOcc.getStartDateTime(), existingOcc.getEndDateTime())) {
                        continue;
                    }

                    boolean isRoomCollision = newOcc.room() != null && !newOcc.room().isBlank()
                            && existingOcc.getRoom() != null
                            && newOcc.room().equalsIgnoreCase(existingOcc.getRoom())
                            && nullableEqual(newOcc.buildingCode(), existingOcc.getBuildingCode());

                    List<String> newTeachersArr2 = deserializeTeachers(newTeachersJson != null ? newTeachersJson : entry.getTeachers());
                    List<String> existingTeachers = deserializeTeachers(candidate.getTeachers());
                    boolean isTeacherCollision = newTeachersArr2.stream()
                            .anyMatch(nt -> existingTeachers.stream().anyMatch(nt::equalsIgnoreCase))
                            && haveCommonGroups(newGroups != null ? newGroups : entry.getStudentGroups(), candidate.getStudentGroups());

                    if (isRoomCollision || isTeacherCollision) {
                        if (!colliding.contains(candidate)) {
                            colliding.add(candidate);
                        }
                        break;
                    }
                }
            }
        }
        return colliding;
    }

    private boolean dateTimeRangesOverlap(LocalDateTime aStart, LocalDateTime aEnd,
            LocalDateTime bStart, LocalDateTime bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    private boolean nullableEqual(String a, String b) {
        if (a == null && b == null)
            return true;
        if (a == null || b == null)
            return false;
        return a.equalsIgnoreCase(b);
    }

    private String formatDt(LocalDateTime dt) {
        if (dt == null)
            return "";
        return dt.toLocalDate().toString() + " " + dt.toLocalTime().toString().substring(0, 5);
    }

    private boolean haveCommonGroups(Set<StudentGroup> a, Set<StudentGroup> b) {
        if (a == null || b == null)
            return false;
        Set<Long> aIds = a.stream().map(StudentGroup::getId).collect(Collectors.toSet());
        return b.stream().anyMatch(g -> aIds.contains(g.getId()));
    }

    // Starosta Permission Check

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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Starosta nie ma przypisanej grupy.");
        }

        boolean hasAccess = entry.getStudentGroups() != null
                && entry.getStudentGroups().stream()
                        .anyMatch(g -> g.getId().equals(starostaGroup.getId()));

        if (!hasAccess) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Starosta może edytować tylko zajęcia swojego kierunku.");
        }
    }

    private void checkStarostaCreatePermission(ScheduleEntryCreateDto dto) {
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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Starosta nie ma przypisanej grupy.");
        }

        if (dto.studentGroupIds() == null || dto.studentGroupIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Musisz przypisać zajęcia do swojego kierunku.");
        }

        boolean targetsOtherGroup = dto.studentGroupIds().stream()
                .anyMatch(id -> !id.equals(starostaGroup.getId()));

        if (targetsOtherGroup) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Starosta może tworzyć zajęcia tylko dla swojego kierunku.");
        }
    }

    private void checkStarostaForceCollisionPermission(ScheduleEntry entry, List<ScheduleOccurrenceDto> occurrences,
            Long excludeId, String newTeachersJson, Set<StudentGroup> newGroups) {
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
        if (starostaGroup == null)
            return; // Should already be checked by earlier permission checks

        List<ScheduleEntry> collidingEntries = findCollidingEntries(entry, occurrences, excludeId, newTeachersJson, newGroups);
        if (collidingEntries.isEmpty())
            return;

        // Starosta can only force if ALL colliding entries belong to their group
        boolean hasExternalCollision = collidingEntries.stream()
                .anyMatch(ce -> ce.getStudentGroups() == null || ce.getStudentGroups().stream()
                        .noneMatch(g -> g.getId().equals(starostaGroup.getId())));

        if (hasExternalCollision) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Jako Starosta nie możesz wymusić zapisu przy kolizji z zajęciami innych grup lub salami ogólnouczelnianymi.");
        }
    }

    // Helpers

    private void validateOccurrenceTimes(List<ScheduleOccurrenceDto> occurrences) {
        if (occurrences == null)
            return;
        for (ScheduleOccurrenceDto occ : occurrences) {
            if (occ.startDateTime() != null && occ.endDateTime() != null
                    && !occ.endDateTime().isAfter(occ.startDateTime())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Godzina zakończenia musi być późniejsza niż godzina rozpoczęcia (termin: "
                                + occ.startDateTime() + ").");
            }
        }
    }

    private ScheduleEntryResponseDto toResponse(ScheduleEntry entry) {
        List<StudentGroupResponseDto> groupDtos = entry.getStudentGroups() != null
                ? entry.getStudentGroups().stream()
                        .map(g -> new StudentGroupResponseDto(g.getId(), g.getName()))
                        .toList()
                : Collections.emptyList();

        List<ScheduleOccurrenceDto> occurrenceDtos = entry.getOccurrences() != null
                ? entry.getOccurrences().stream()
                        .sorted((a, b) -> a.getStartDateTime().compareTo(b.getStartDateTime()))
                        .map(o -> new ScheduleOccurrenceDto(
                                o.getId(),
                                o.getStartDateTime(), o.getEndDateTime(),
                                o.getRoom(), o.getBuildingCode(), o.getLocation()))
                        .toList()
                : Collections.emptyList();

        return new ScheduleEntryResponseDto(
                entry.getId(),
                entry.getTitle(),
                deserializeTeachers(entry.getTeachers()),
                entry.getClassType(),
                entry.getCreditType(),
                groupDtos,
                occurrenceDtos,
                entry.getArchived(),
                entry.getArchivedAt(),
                entry.getGroupNumber(),
                entry.getSpecialization(),
                entry.getYearPlan());
    }

    private ScheduleEntry toEntity(ScheduleEntryCreateDto dto) {
        ScheduleEntry entry = new ScheduleEntry();
        entry.setTitle(dto.title().trim());
        entry.setTeachers(serializeTeachers(dto.teachers()));
        entry.setClassType(dto.classType());
        entry.setCreditType(dto.creditType());
        entry.setGroupNumber(dto.groupNumber());
        entry.setSpecialization(dto.specialization());
        entry.setYearPlan(dto.yearPlan());
        entry.setArchived(false);
        entry.setArchivedAt(null);
        return entry;
    }

    private Set<StudentGroup> resolveGroups(List<Long> groupIds) {
        Set<StudentGroup> groups = new HashSet<>();
        for (Long groupId : groupIds) {
            StudentGroup group = studentGroupRepository.findById(groupId)
                    .orElseThrow(() -> new StudentGroupNotFoundException(groupId));
            groups.add(group);
        }
        return groups;
    }

    private String serializeTeachers(List<String> teachers) {
        if (teachers == null || teachers.isEmpty())
            return "[]";
        try {
            return objectMapper.writeValueAsString(teachers);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private List<String> deserializeTeachers(String json) {
        if (json == null || json.isBlank())
            return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (JsonProcessingException e) {
            return Collections.emptyList();
        }
    }
}