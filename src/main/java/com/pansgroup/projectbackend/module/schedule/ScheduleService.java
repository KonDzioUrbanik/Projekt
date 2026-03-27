package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryResponseDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryUpdateDto;

import java.util.List;

public interface ScheduleService {

    // ----------- OPERACJE CRUD -----------
    ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto);

    /** Tworzy wpis z opcjonalnym pominięciem walidacji kolizji (force=true) */
    ScheduleEntryResponseDto create(ScheduleEntryCreateDto dto, boolean force);

    ScheduleEntryResponseDto update(Long id, ScheduleEntryUpdateDto dto);

    /** Aktualizuje wpis z opcjonalnym pominięciem walidacji kolizji (force=true) */
    ScheduleEntryResponseDto update(Long id, ScheduleEntryUpdateDto dto, boolean force);

    void delete(Long id);

    void deleteByGroupId(Long groupId);

    ScheduleEntryResponseDto archive(Long id);

    ScheduleEntryResponseDto restore(Long id);

    int archiveActive(String yearPlan);

    // ----------- OPERACJE ODCZYTU -----------
    ScheduleEntryResponseDto findById(Long id);

    List<ScheduleEntryResponseDto> findAll();

    List<ScheduleEntryResponseDto> getMySchedule(String userEmail);
}