package com.pansgroup.projectbackend.controller;

import com.pansgroup.projectbackend.dto.NoteCreateDto;
import com.pansgroup.projectbackend.dto.NoteResponseDto;
import com.pansgroup.projectbackend.dto.NoteUpdateDto;
import com.pansgroup.projectbackend.service.NoteService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("api/notes")
public class NoteController {
    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @PostMapping
    public NoteResponseDto create(@Valid @RequestBody NoteCreateDto dto) {
        return noteService.create(dto);
    }

    @PutMapping("/{id}")
    public NoteResponseDto update(@PathVariable Long id, @Valid @RequestBody NoteUpdateDto dto) {
        return noteService.update(id, dto);
    }


    @GetMapping
    public List<NoteResponseDto> all() {
        return noteService.findAll();
    }

    @GetMapping("/by-user/{userId}")
    public List<NoteResponseDto> byUser(@PathVariable Long userId) {
        return noteService.findByUser(userId);
    }
}

