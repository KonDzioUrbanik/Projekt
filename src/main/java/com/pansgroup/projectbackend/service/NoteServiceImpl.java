package com.pansgroup.projectbackend.service;

import com.pansgroup.projectbackend.dto.NoteCreateDto;
import com.pansgroup.projectbackend.dto.NoteResponseDto;
import com.pansgroup.projectbackend.dto.NoteUpdateDto;
import com.pansgroup.projectbackend.exception.NoteNotFoundException;
import com.pansgroup.projectbackend.exception.UserNotFoundException;
import com.pansgroup.projectbackend.model.Note;
import com.pansgroup.projectbackend.model.User;
import com.pansgroup.projectbackend.repository.NoteRepository;
import com.pansgroup.projectbackend.repository.UserRepository;
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
    public NoteResponseDto create(NoteCreateDto dto) {
        User author = userRepository.findById(dto.userId())
                .orElseThrow(() -> new UserNotFoundException(dto.userId()));

        Note note = new Note();
        note.setTitle(dto.title().trim());
        note.setContent(dto.content().trim());
        note.setAuthor(author);

        Note saved = noteRepository.save(note);
        return toResponse(saved);
    }

    @Override
    public NoteResponseDto update(Long id, NoteUpdateDto dto) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new NoteNotFoundException(id));

        note.setTitle(dto.title().trim());
        note.setContent(dto.content().trim());

        Note updated = noteRepository.save(note);
        return toResponse(updated);
    }


    @Override
    public List<NoteResponseDto> findAll() {
        return noteRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<NoteResponseDto> findByUser(Long userId) {
        // verify user exists to return 404 on invalid id
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
}

