package com.pansgroup.projectbackend.module.deadline;

import com.pansgroup.projectbackend.module.deadline.dto.DeadlineCreateDto;
import com.pansgroup.projectbackend.module.deadline.dto.DeadlineResponseDto;

import java.util.List;

public interface DeadlineService {
    List<DeadlineResponseDto> getMyDeadlines(String currentUserEmail);
    DeadlineResponseDto create(DeadlineCreateDto dto, String currentUserEmail);
    void delete(Long id, String currentUserEmail);
}
