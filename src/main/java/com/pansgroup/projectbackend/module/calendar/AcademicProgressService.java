package com.pansgroup.projectbackend.module.calendar;

import com.pansgroup.projectbackend.module.calendar.dto.AcademicProgressDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AcademicProgressService {

    private final CalendarEventRepository calendarEventRepository;

    public AcademicProgressDto getProgress(LocalDate date) {
        List<CalendarEvent> allEvents = calendarEventRepository.findAll();

        // 1. Zdefiniuj rok akademicki na podstawie przekazanej daty
        int academicYearStart = date.getMonthValue() >= 10 ? date.getYear() : date.getYear() - 1;

        // Szukaj zgrubnych ram semestrów na podstawie wydarzeń DIDACTIC
        LocalDate winterSemStart = allEvents.stream()
                .filter(e -> e.getType() == CalendarEventType.DIDACTIC)
                .filter(e -> e.getDateFrom().getYear() == academicYearStart && e.getDateFrom().getMonthValue() >= 9)
                .map(CalendarEvent::getDateFrom)
                .min(Comparator.naturalOrder())
                .orElse(LocalDate.of(academicYearStart, 10, 1)); // Domyślnie 1 października

        LocalDate winterSessionEnd = allEvents.stream()
                .filter(e -> e.getType() == CalendarEventType.EXAM)
                .filter(e -> e.getDateFrom().getYear() == academicYearStart + 1 && e.getDateFrom().getMonthValue() <= 3)
                .map(CalendarEvent::getDateTo)
                .max(Comparator.naturalOrder())
                .orElse(LocalDate.of(academicYearStart + 1, 2, 28)); // Domyślnie koniec lutego

        LocalDate summerSemStart = allEvents.stream()
                .filter(e -> e.getType() == CalendarEventType.DIDACTIC)
                .filter(e -> e.getDateFrom().getYear() == academicYearStart + 1 && e.getDateFrom().getMonthValue() >= 2 && e.getDateFrom().getMonthValue() <= 4)
                .map(CalendarEvent::getDateFrom)
                .min(Comparator.naturalOrder())
                .orElse(winterSessionEnd.plusDays(1)); // Domyślnie start po sesji zimowej

        LocalDate summerSessionEnd = allEvents.stream()
                .filter(e -> e.getType() == CalendarEventType.EXAM)
                .filter(e -> e.getDateTo().getYear() == academicYearStart + 1 && e.getDateTo().getMonthValue() >= 6 && e.getDateTo().getMonthValue() <= 7)
                .map(CalendarEvent::getDateTo)
                .max(Comparator.naturalOrder())
                .orElse(LocalDate.of(academicYearStart + 1, 6, 30)); // Domyślnie końcówka czerwca

        // Ustal, w którym semestrze jesteśmy
        boolean isWinterSemester = !date.isBefore(winterSemStart) && date.isBefore(summerSemStart);
        
        LocalDate currentSemStart = isWinterSemester ? winterSemStart : summerSemStart;
        LocalDate currentSemEnd = isWinterSemester ? winterSessionEnd : summerSessionEnd;

        // Jeśli przed rozpoczęciem roku akademickiego
        if (date.isBefore(winterSemStart)) {
            currentSemStart = winterSemStart;
            currentSemEnd = winterSessionEnd;
        }
        
        // Obliczanie postępu na podstawie nowych ram semestru
        int totalDays = (int) ChronoUnit.DAYS.between(currentSemStart, currentSemEnd) + 1;
        int currentDay = 0;
        double progress = 0;

        if (date.isBefore(currentSemStart)) {
            progress = 0;
            currentDay = 0;
        } else if (date.isAfter(currentSemEnd)) {
            progress = 100;
            currentDay = totalDays;
        } else {
            currentDay = (int) ChronoUnit.DAYS.between(currentSemStart, date) + 1;
            progress = (double) currentDay / totalDays * 100;
        }

        // 2. Tydzień A/B
        String weekType = calculateWeekType(date, summerSemStart);

        // 3. Najbliższa przerwa (BREAK lub HOLIDAY)
        CalendarEvent nearestBreak = allEvents.stream()
                .filter(e -> e.getType() == CalendarEventType.BREAK || e.getType() == CalendarEventType.HOLIDAY)
                .filter(e -> e.getDateFrom().isAfter(date) || (!date.isBefore(e.getDateFrom()) && !date.isAfter(e.getDateTo())))
                .min(Comparator.comparing(CalendarEvent::getDateFrom))
                .orElse(null);

        // 4. Najbliższa sesja (EXAM)
        CalendarEvent nearestSession = allEvents.stream()
                .filter(e -> e.getType() == CalendarEventType.EXAM)
                .filter(e -> e.getDateFrom().isAfter(date) || (!date.isBefore(e.getDateFrom()) && !date.isAfter(e.getDateTo())))
                .min(Comparator.comparing(CalendarEvent::getDateFrom))
                .orElse(null);

        // 5. Timeline (wszystkie wydarzenia w obrębie danego semestru)
        LocalDate finalSemStart = currentSemStart;
        LocalDate finalSemEnd = currentSemEnd;
        List<CalendarEventDto> timeline = allEvents.stream()
                .filter(e -> !e.getDateTo().isBefore(finalSemStart) && !e.getDateFrom().isAfter(finalSemEnd))
                .sorted(Comparator.comparing(CalendarEvent::getDateFrom))
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return AcademicProgressDto.builder()
                .semesterProgress(Math.round(Math.min(100.0, Math.max(0.0, progress)) * 10.0) / 10.0)
                .currentDay(currentDay)
                .totalDays(totalDays)
                .currentWeekType(weekType)
                .semesterName(isWinterSemester ? "zimowy" : "letni")
                .nearestBreak(mapToDto(nearestBreak))
                .daysToBreak(nearestBreak != null ? calculateDaysLeft(date, nearestBreak.getDateFrom()) : null)
                .nearestSession(mapToDto(nearestSession))
                .daysToSession(nearestSession != null ? calculateDaysLeft(date, nearestSession.getDateFrom()) : null)
                .semesterStart(currentSemStart)
                .semesterEnd(currentSemEnd)
                .timelineEvents(timeline)
                .build();
    }

    private String calculateWeekType(LocalDate date, LocalDate summerStart) {
        int weekNumber = date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        
        if (date.isBefore(summerStart)) {
            // Zimowy: Parzysty = A, Nieparzysty = B
            return weekNumber % 2 == 0 ? "WEEK_A" : "WEEK_B";
        } else {
            // Letni: Nieparzysty = A, Parzysty = B
            return weekNumber % 2 != 0 ? "WEEK_A" : "WEEK_B";
        }
    }

    private Long calculateDaysLeft(LocalDate today, LocalDate eventStart) {
        if (!today.isBefore(eventStart)) return 0L;
        return ChronoUnit.DAYS.between(today, eventStart);
    }

    private CalendarEventDto mapToDto(CalendarEvent event) {
        if (event == null) return null;
        return CalendarEventDto.builder()
                .id(event.getId())
                .title(event.getTitle())
                .dateFrom(event.getDateFrom())
                .dateTo(event.getDateTo())
                .type(event.getType())
                .markerColor(event.getMarkerColor())
                .build();
    }
}
