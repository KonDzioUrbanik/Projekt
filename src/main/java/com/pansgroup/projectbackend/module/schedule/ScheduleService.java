package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryResponseDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryUpdateDto;

import java.util.List;

public interface ScheduleService {

    // ----------- OPERACJE CRUD DLA ADMINISTRATORA -----------
    ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto);
    ScheduleEntryResponseDto update(Long id, ScheduleEntryUpdateDto dto);
    void delete(Long id);
    // ----------- OPERACJE ODCZYTU -----------
    ScheduleEntryResponseDto findById(Long id);
    List<ScheduleEntryResponseDto> findAll();
    List<ScheduleEntryResponseDto> getMySchedule(String userEmail);
}