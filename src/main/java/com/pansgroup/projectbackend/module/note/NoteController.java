package com.pansgroup.projectbackend.module.note;

import com.pansgroup.projectbackend.module.note.dto.*;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("api/notes")
public class NoteController {
    private final NoteServiceImpl noteService;

    public NoteController(NoteServiceImpl noteService) {
        this.noteService = noteService;
    }

    @PostMapping
    public NoteResponseDto create(@Valid @RequestBody NoteCreateDto dto, Principal principal) {
        String email = principal.getName();
        return noteService.create(dto, email);
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

    // === NOWE ENDPOINTY: WSPÓŁDZIELENIE ===

    @PostMapping("/{id}/share")
    public ResponseEntity<NoteDTO> shareNote(
            @PathVariable Long id,
            @RequestBody ShareNoteRequest request) {
        NoteDTO note = noteService.shareNote(id, request);
        return ResponseEntity.ok(note);
    }

    @GetMapping("/shared-with-me")
    public ResponseEntity<List<NoteDTO>> getSharedWithMe() {
        List<NoteDTO> notes = noteService.getSharedWithMe();
        return ResponseEntity.ok(notes);
    }

    @GetMapping("/group")
    public ResponseEntity<List<NoteDTO>> getGroupNotes() {
        List<NoteDTO> notes = noteService.getGroupNotes();
        return ResponseEntity.ok(notes);
    }

    @GetMapping("/public")
    public ResponseEntity<List<NoteDTO>> getPublicNotes() {
        List<NoteDTO> notes = noteService.getPublicNotes();
        return ResponseEntity.ok(notes);
    }

    @GetMapping("/accessible")
    public ResponseEntity<List<NoteDTO>> getAllAccessibleNotes() {
        List<NoteDTO> notes = noteService.getAllAccessibleNotes();
        return ResponseEntity.ok(notes);
    }

    // === ULUBIONE ===

    @PostMapping("/{id}/favorite")
    public ResponseEntity<NoteDTO> toggleFavorite(@PathVariable Long id) {
        NoteDTO note = noteService.toggleFavorite(id);
        return ResponseEntity.ok(note);
    }

    @GetMapping("/favorites")
    public ResponseEntity<List<NoteDTO>> getFavorites() {
        List<NoteDTO> notes = noteService.getFavorites();
        return ResponseEntity.ok(notes);
    }

    // === TAGI ===

    @PutMapping("/{id}/tags")
    public ResponseEntity<NoteDTO> updateTags(
            @PathVariable Long id,
            @RequestBody String tags) {
        NoteDTO note = noteService.updateTags(id, tags);
        return ResponseEntity.ok(note);
    }

    @GetMapping("/search/tag")
    public ResponseEntity<List<NoteDTO>> searchByTag(@RequestParam String tag) {
        List<NoteDTO> notes = noteService.searchByTag(tag);
        return ResponseEntity.ok(notes);
    }

    // === KOPIOWANIE ===

    @PostMapping("/{id}/copy")
    public ResponseEntity<NoteDTO> copyNote(@PathVariable Long id) {
        NoteDTO note = noteService.copyNote(id);
        return ResponseEntity.ok(note);
    }

    @GetMapping("/{id}/shared-users")
    public ResponseEntity<List<UserResponseDto>> getSharedUsers(@PathVariable Long id) {
        List<UserResponseDto> users = noteService.getNoteSharedUsers(id);
        return ResponseEntity.ok(users);
    }
}
