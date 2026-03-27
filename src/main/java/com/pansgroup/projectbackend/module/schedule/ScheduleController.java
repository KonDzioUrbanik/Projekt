package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryResponseDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private final ScheduleService scheduleService;

    public ScheduleController(ScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }

    // ---------- ODCZYT ----------

    @GetMapping
    public List<ScheduleEntryResponseDto> getMySchedule(Principal principal) {
        return scheduleService.getMySchedule(principal.getName());
    }

    @GetMapping("/all")
    public List<ScheduleEntryResponseDto> getAllSchedules() {
        return scheduleService.findAll();
    }

    @GetMapping("/{id}")
    public ScheduleEntryResponseDto getById(@PathVariable Long id) {
        return scheduleService.findById(id);
    }

    // ---------- MODYFIKACJA (ADMIN / STAROSTA) ----------

    /**
     * Tworzy nowy wpis.
     * Parametr ?force=true pozwala pominąć walidację kolizji (wyłącznie ADMIN).
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleEntryResponseDto create(
            @Valid @RequestBody ScheduleEntryCreateDto dto,
            @RequestParam(defaultValue = "false") boolean force) {
        return scheduleService.create(dto, force);
    }

    /**
     * Aktualizuje wpis.
     * Parametr ?force=true pozwala pominąć walidację kolizji (wyłącznie ADMIN).
     */
    @PutMapping("/{id}")
    public ScheduleEntryResponseDto update(
            @PathVariable Long id,
            @Valid @RequestBody ScheduleEntryUpdateDto dto,
            @RequestParam(defaultValue = "false") boolean force) {
        return scheduleService.update(id, dto, force);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        scheduleService.delete(id);
    }

    @DeleteMapping("/group/{groupId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteByGroup(@PathVariable Long groupId) {
        scheduleService.deleteByGroupId(groupId);
    }

    @PutMapping("/{id}/archive")
    public ScheduleEntryResponseDto archive(@PathVariable Long id) {
        return scheduleService.archive(id);
    }

    @PutMapping("/{id}/restore")
    public ScheduleEntryResponseDto restore(@PathVariable Long id) {
        return scheduleService.restore(id);
    }

    @PutMapping("/archive")
    public Map<String, Integer> archiveActive(@RequestParam(required = false) String yearPlan) {
        int archivedCount = scheduleService.archiveActive(yearPlan);
        return Map.of("archivedCount", archivedCount);
    }
}