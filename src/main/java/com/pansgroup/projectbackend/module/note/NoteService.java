package com.pansgroup.projectbackend.module.note;

import com.pansgroup.projectbackend.module.note.dto.NoteCreateDto;
import com.pansgroup.projectbackend.module.note.dto.NoteResponseDto;
import com.pansgroup.projectbackend.module.note.dto.NoteUpdateDto;

import java.util.List;

public interface NoteService {
    NoteResponseDto create(NoteCreateDto dto, String email);

    NoteResponseDto update(Long id, NoteUpdateDto dto);

    void delete(Long id);

    NoteResponseDto findById(Long id);

    List<NoteResponseDto> findAll();

    List<NoteResponseDto> findByUser(Long userId);
}

