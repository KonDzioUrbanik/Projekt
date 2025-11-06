package com.pansgroup.projectbackend.module.student;

import com.pansgroup.projectbackend.module.student.dto.StudentGroupCreateDto;
import com.pansgroup.projectbackend.module.student.dto.StudentGroupResponseDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
public class StudentGroupController {
    StudentGroupService studentGroupService;
    public StudentGroupController(StudentGroupService studentGroupService) {
        this.studentGroupService = studentGroupService;
    }
    @GetMapping
    public List<StudentGroupResponseDto> getAll() {
        return studentGroupService.findAll();
    }
    @PostMapping
    public StudentGroupResponseDto create(@Valid @RequestBody StudentGroupCreateDto dto) {
        return studentGroupService.create(dto);
    }

    @GetMapping("/{id}")
    public StudentGroupResponseDto findById(@PathVariable Long id) {
        return studentGroupService.findById(id);
    }
    @PutMapping("/{id}")
    public StudentGroupResponseDto update(@PathVariable Long id,@Valid @RequestBody StudentGroupCreateDto dto) {
        return studentGroupService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        studentGroupService.delete(id);
    }

}
