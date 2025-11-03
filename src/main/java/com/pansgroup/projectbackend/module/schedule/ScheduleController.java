package com.pansgroup.projectbackend.module.schedule;

import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryCreateDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryResponseDto;
import com.pansgroup.projectbackend.module.schedule.dto.ScheduleEntryUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private final ScheduleService scheduleService;

    public ScheduleController(ScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }

    // ---------- ENDPOINTY DLA STUDENTÓW (ODCZYT) ----------

    @GetMapping
    public List<ScheduleEntryResponseDto> getMySchedule(Principal principal) {
        String userEmail = principal.getName();
        return scheduleService.getMySchedule(userEmail);
    }

    @GetMapping("/{id}")
    public ScheduleEntryResponseDto getById(@PathVariable Long id) {
        return scheduleService.findById(id);
    }

    // ---------- ENDPOINTY DLA ADMINISTRATORÓW (MODYFIKACJA) ----------

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED) // Zwraca 201 Created
    public ScheduleEntryResponseDto create(@Valid @RequestBody ScheduleEntryCreateDto dto) {
        return scheduleService.create(dto);
    }

    @PutMapping("/{id}")
    public ScheduleEntryResponseDto update(@PathVariable Long id, @Valid @RequestBody ScheduleEntryUpdateDto dto) {
        return scheduleService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        scheduleService.delete(id);
    }
}