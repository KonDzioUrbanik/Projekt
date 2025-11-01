package com.pansgroup.projectbackend.service;

import com.pansgroup.projectbackend.dto.NoteCreateDto;
import com.pansgroup.projectbackend.dto.NoteResponseDto;
import com.pansgroup.projectbackend.dto.NoteUpdateDto;

import java.util.List;

public interface NoteService {
    NoteResponseDto create(NoteCreateDto dto);
    NoteResponseDto update(Long id, NoteUpdateDto dto);
    List<NoteResponseDto> findAll();
    List<NoteResponseDto> findByUser(Long userId);
}

