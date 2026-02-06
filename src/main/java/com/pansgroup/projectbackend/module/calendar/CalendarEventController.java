package com.pansgroup.projectbackend.module.calendar;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/calendar")
@Tag(name = "Calendar", description = "University Calendar Management")
public class CalendarEventController {

    private final CalendarEventService calendarEventService;

    public CalendarEventController(CalendarEventService calendarEventService) {
        this.calendarEventService = calendarEventService;
    }

    @GetMapping
    public ResponseEntity<List<CalendarEventDto>> getAllEvents() {
        return ResponseEntity.ok(calendarEventService.getAllEvents());
    }

    /**
     * Zwraca aktywny okres specjalny (sesja, przerwa, święto) dla dzisiejszej daty.
     * Jeśli brak takiego okresu, zwraca 204 No Content.
     */
    @GetMapping("/active")
    public ResponseEntity<CalendarEventDto> getActiveSpecialPeriod() {
        return calendarEventService.getActiveSpecialPeriod(LocalDate.now())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping
    public ResponseEntity<CalendarEventDto> createEvent(@RequestBody CalendarEventDto dto) {
        return ResponseEntity.ok(calendarEventService.createEvent(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CalendarEventDto> updateEvent(@PathVariable Long id, @RequestBody CalendarEventDto dto) {
        return ResponseEntity.ok(calendarEventService.updateEvent(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        calendarEventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }
}
