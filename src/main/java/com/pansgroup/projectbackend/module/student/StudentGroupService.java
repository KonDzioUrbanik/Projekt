package com.pansgroup.projectbackend.module.student;

import com.pansgroup.projectbackend.module.student.dto.StudentGroupCreateDto;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;

import java.util.List;

public interface StudentGroupService {
    StudentGroupResponseDto create(StudentGroupCreateDto dto);
    StudentGroupResponseDto findById(Long id);
    List<StudentGroupResponseDto> findAll();
    StudentGroupResponseDto update(Long id, StudentGroupCreateDto dto);
    void delete(Long id);
}
