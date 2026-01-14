package com.pansgroup.projectbackend.module.note;

import com.pansgroup.projectbackend.module.note.dto.NoteCreateDto;
import com.pansgroup.projectbackend.module.note.dto.NoteResponseDto;
import com.pansgroup.projectbackend.module.note.dto.NoteUpdateDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("api/notes")
public class NoteController {
    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @PostMapping
    public NoteResponseDto create(@Valid @RequestBody NoteCreateDto dto, Principal principal) {
        String firstName = principal.getName();
        return noteService.create(dto,firstName);
    }

    @PutMapping("/{id}")
    public NoteResponseDto update(@PathVariable Long id, @Valid @RequestBody NoteUpdateDto dto) {
        return noteService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        noteService.delete(id);
    }

    @GetMapping("/{id}")
    public NoteResponseDto getById(@PathVariable Long id) {
        return noteService.findById(id);
    }

    @GetMapping
    public List<NoteResponseDto> all() {
        return noteService.findAll();
    }
    
    @GetMapping("/my-notes")
    public List<NoteResponseDto> myNotes(Principal principal) {
        String email = principal.getName();
        return noteService.findByUserEmail(email);
    }

    @GetMapping("/by-user/{userId}")
    public List<NoteResponseDto> byUser(@PathVariable Long userId) {
        return noteService.findByUser(userId);
    }
}

