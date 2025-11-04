package com.pansgroup.projectbackend.module.student;

import com.pansgroup.projectbackend.exception.StudentGroupNotFoundException;
import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.note.Note;
import com.pansgroup.projectbackend.module.note.dto.NoteResponseDto;
import com.pansgroup.projectbackend.module.schedule.ScheduleEntry;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupCreateDto;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;
import com.pansgroup.projectbackend.module.user.User;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentGroupServiceImpl implements StudentGroupService{
    private final StudentGroupRepository studentGroupRepository;
    public StudentGroupServiceImpl(StudentGroupRepository studentGroupRepository) {
        this.studentGroupRepository = studentGroupRepository;
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
        entry.setName(dto.name().trim());
        return entry;
    }


    @Override
    public StudentGroupResponseDto create(StudentGroupCreateDto dto) {
        StudentGroup entry = toEntity(dto);
        StudentGroup saved = studentGroupRepository.save(entry);
        return toResponse(saved);
    }

    @Override
    public StudentGroupResponseDto findById(Long id) {
        StudentGroup entity = studentGroupRepository.findById(id)
                .orElseThrow(() -> {return new StudentGroupNotFoundException(">" + id + "<");
                });
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
        entity.setName(dto.name().trim());
        StudentGroup updated = studentGroupRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        StudentGroup entity = studentGroupRepository.findById(id)
                .orElseThrow(() -> new StudentGroupNotFoundException(">" + id + "<"));
        studentGroupRepository.delete(entity);
    }
}
