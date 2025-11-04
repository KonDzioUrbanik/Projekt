package com.pansgroup.projectbackend.module.student;

import com.pansgroup.projectbackend.exception.StudentGroupNotFoundException;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupCreateDto;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StudentGroupServiceImpl implements StudentGroupService {
    private final StudentGroupRepository studentGroupRepository;
    private final UserService userService;

    public StudentGroupServiceImpl(StudentGroupRepository studentGroupRepository, UserService userService) {
        this.studentGroupRepository = studentGroupRepository;
        this.userService = userService;
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
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin) {
            StudentGroup entity = studentGroupRepository.findById(id)
                    .orElseThrow(() -> new StudentGroupNotFoundException(">" + id + "<"));
            return toResponse(entity);
        }
        String userEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userService.findUserByEmailInternal(userEmail);

        if (currentUser.getStudentGroup() != null && currentUser.getStudentGroup().getId().equals(id)) {
            throw new StudentGroupNotFoundException("Nie masz uprawnień do grupy: >" + id + "<");
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
