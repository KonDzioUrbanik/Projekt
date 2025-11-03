package com.pansgroup.projectbackend.module.note;

import com.pansgroup.projectbackend.exception.NoteNotFoundException;
import com.pansgroup.projectbackend.exception.UserNotFoundException;
import com.pansgroup.projectbackend.exception.UsernameNotFoundException;
import com.pansgroup.projectbackend.module.note.dto.NoteCreateDto;
import com.pansgroup.projectbackend.module.note.dto.NoteResponseDto;
import com.pansgroup.projectbackend.module.note.dto.NoteUpdateDto;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class NoteServiceImpl implements NoteService {
    private final NoteRepository noteRepository;
    private final UserRepository userRepository;

    public NoteServiceImpl(NoteRepository noteRepository, UserRepository userRepository) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
    }

    @Override
    public NoteResponseDto create(NoteCreateDto dto, String email) {
        User author = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Użytkownik o e-mailu: " + email + " nie istnieje"));

        Note note = new Note();
        note.setTitle(dto.title().trim());
        note.setContent(dto.content().trim());
        note.setAuthor(author);

        Note saved = noteRepository.save(note);
        return toResponse(saved);
    }

    @Override
    public NoteResponseDto update(Long id, NoteUpdateDto dto) {
        Note note = findNoteByIdAndEnsureOwnership(id);

        note.setTitle(dto.title().trim());
        note.setContent(dto.content().trim());

        Note updated = noteRepository.save(note);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        Note note = findNoteByIdAndEnsureOwnership(id);
        noteRepository.delete(note);
    }

    @Override
    public NoteResponseDto findById(Long id) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new NoteNotFoundException(id));
        return toResponse(note);
    }

    @Override
    public List<NoteResponseDto> findAll() {
        return noteRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<NoteResponseDto> findByUser(Long userId) {
        // verify users exists to return 404 on invalid id
        if (!userRepository.existsById(userId)) {
            throw new UserNotFoundException(userId);
        }
        return noteRepository.findByAuthor_Id(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    private NoteResponseDto toResponse(Note n) {
        User u = n.getAuthor();
        return new NoteResponseDto(
                n.getId(),
                n.getTitle(),
                n.getContent(),
                u.getId(),
                u.getFirstName(),
                u.getLastName(),
                n.getCreatedAt(),
                n.getUpdatedAt()
        );
    }

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Użytkownik nie jest uwierzytelniony.");
        }
        return authentication.getName();
    }


    private Note findNoteByIdAndEnsureOwnership(Long noteId) {
        String userEmail = getCurrentUserEmail();

        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NoteNotFoundException(noteId));

        if (!note.getAuthor().getEmail().equals(userEmail)) {
            throw new NoteNotFoundException(noteId);
        }

        return note;
    }

}

