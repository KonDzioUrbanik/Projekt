package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.exception.ScheduleEntryNotFoundException;
import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryResponseDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryUpdateDto;
import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@Transactional
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;

    // Wstrzyknięcie zależności Repozytorium
    public ScheduleServiceImpl(ScheduleRepository scheduleRepository, UserRepository userRepository) {
        this.scheduleRepository = scheduleRepository;
        this.userRepository = userRepository;
    }

    @Override
    public ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto) {
        ScheduleEntry entry = toEntity(dto);
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

        ScheduleEntry updated = scheduleRepository.save(entry);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        // Wyszukanie i usunięcie wpisu, rzucenie wyjątku 404, jeśli nie istnieje
        ScheduleEntry entry = scheduleRepository.findById(id)
                .orElseThrow(() -> new ScheduleEntryNotFoundException(id));
        scheduleRepository.delete(entry);
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
            return scheduleRepository.findByStudentGroups(group).stream().map(this::toResponse).toList();
        }

    }

    // ---------- METODY POMOCNICZE (Konwersja) ----------

    private ScheduleEntryResponseDto toResponse(ScheduleEntry entry) {
        return new ScheduleEntryResponseDto(
                entry.getId(),
                entry.getTitle(),
                entry.getRoom(),
                entry.getTeacher(),
                entry.getDayOfWeek(),
                entry.getStartTime(),
                entry.getEndTime()
        );
    }

    private ScheduleEntry toEntity(ScheduleEntryCreateDto dto) {
        ScheduleEntry entry = new ScheduleEntry();
        entry.setTitle(dto.title().trim());
        entry.setRoom(dto.room().trim());
        entry.setTeacher(dto.teacher().trim());
        entry.setDayOfWeek(dto.dayOfWeek());
        entry.setStartTime(dto.startTime());
        entry.setEndTime(dto.endTime());
        return entry;
    }
}