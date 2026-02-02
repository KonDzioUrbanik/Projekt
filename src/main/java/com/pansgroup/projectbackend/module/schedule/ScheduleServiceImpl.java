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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

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

        entry.setWeekType(dto.weekType());

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
                entry.getWeekType());
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
        entry.setWeekType(dto.weekType());
        // studentGroups są ustawiane w metodzie create
        return entry;
    }
}