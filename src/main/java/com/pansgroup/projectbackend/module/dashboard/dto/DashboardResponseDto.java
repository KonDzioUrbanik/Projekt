package com.pansgroup.projectbackend.module.dashboard.dto;

import com.pansgroup.projectbackend.module.note.dto.NoteResponseDto;
import com.pansgroup.projectbackend.module.user.dto.UserResponseDto;

import java.util.List;

public record DashboardResponseDto(
        UserResponseDto user,
        List<NoteResponseDto> notes
) {
}
