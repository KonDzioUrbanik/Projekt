package com.pansgroup.projectbackend.module.calendar;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class CalendarEventService {

    private final CalendarEventRepository calendarEventRepository;

    public CalendarEventService(CalendarEventRepository calendarEventRepository) {
        this.calendarEventRepository = calendarEventRepository;
    }

    public List<CalendarEventDto> getAllEvents() {
        return calendarEventRepository.findAllByOrderByDateFromAsc().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    /**
     * Zwraca aktywny okres specjalny (BREAK, HOLIDAY, EXAM) dla podanej daty.
     * Jeśli brak takiego okresu, zwraca Optional.empty()
     */
    public Optional<CalendarEventDto> getActiveSpecialPeriod(LocalDate date) {
        List<CalendarEventType> blockingTypes = Arrays.asList(
                CalendarEventType.BREAK,
                CalendarEventType.HOLIDAY,
                CalendarEventType.EXAM);

        List<CalendarEvent> events = calendarEventRepository.findActiveEventsByTypesAndDate(blockingTypes, date);

        if (events.isEmpty()) {
            return Optional.empty();
        }

        // Zwróć pierwszy znaleziony (posortowane po dateFrom)
        return Optional.of(mapToDto(events.get(0)));
    }

    public CalendarEventDto createEvent(CalendarEventDto dto) {
        CalendarEvent event = CalendarEvent.builder()
                .title(dto.getTitle())
                .dateFrom(dto.getDateFrom())
                .dateTo(dto.getDateTo())
                .dateTo(dto.getDateTo())
                .type(dto.getType())
                .markerColor(dto.getMarkerColor())
                .build();

        CalendarEvent saved = calendarEventRepository.save(event);
        return mapToDto(saved);
    }

    public CalendarEventDto updateEvent(Long id, CalendarEventDto dto) {
        CalendarEvent event = calendarEventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + id));

        event.setTitle(dto.getTitle());
        event.setDateFrom(dto.getDateFrom());
        event.setDateTo(dto.getDateTo());
        event.setType(dto.getType());
        event.setMarkerColor(dto.getMarkerColor());

        // Transactional saves changes automatically
        return mapToDto(event);
    }

    public void deleteEvent(Long id) {
        calendarEventRepository.deleteById(id);
    }

    private CalendarEventDto mapToDto(CalendarEvent event) {
        return CalendarEventDto.builder()
                .id(event.getId())
                .title(event.getTitle())
                .dateFrom(event.getDateFrom())
                .dateTo(event.getDateTo())
                .dateTo(event.getDateTo())
                .type(event.getType())
                .markerColor(event.getMarkerColor())
                .formattedDateRange(formatDateRange(event))
                .build();
    }

    private String formatDateRange(CalendarEvent event) {
        // Formater daty z polskimi nazwami miesięcy (odmiana "października" wymaga
        // custom logic lub Locale)
        // DateTimeFormatter z Locale.forLanguageTag("pl-PL") zwraca mianownik
        // ("styczeń"), a my chcemy "stycznia".
        // Proste obejście: "1" + " " + nazwa_miesiaca + " - " ...
        // Lub użycie wbudowanego formatowania, które czasem jest wystarczające.

        DateTimeFormatter dayFormatter = DateTimeFormatter.ofPattern("d");
        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("MMMM", Locale.forLanguageTag("pl-PL"));

        String fromDay = event.getDateFrom().format(dayFormatter);
        String fromMonth = event.getDateFrom().format(monthFormatter);

        String toDay = event.getDateTo().format(dayFormatter);
        String toMonth = event.getDateTo().format(monthFormatter);

        // Prostowanie odmiany (bardzo basic) - w Java Time API standard "MMMM" w PL to
        // mianownik.
        // Dla potrzeb UX zamienimy końcówki (bardzo naiwna implementacja, ale działa
        // dla polskich miesięcy)
        fromMonth = inflectMonth(fromMonth);
        toMonth = inflectMonth(toMonth);

        return fromDay + " " + fromMonth + " - " + toDay + " " + toMonth;
    }

    private String inflectMonth(String month) {
        if (month.endsWith("y") || month.endsWith("i")) {
            // lutego, maja -> maja
            // styczeń -> stycznia
            // luty -> lutego
            // marzec -> marca
            // kwiecień -> kwietnia
            // maj -> maja
            // czerwiec -> czerwca
            // lipiec -> lipca
            // sierpień -> sierpnia
            // wrzesień -> września
            // październik -> października
            // listopad -> listopada
            // grudzień -> grudnia
        }

        switch (month.toLowerCase()) {
            case "styczeń":
                return "stycznia";
            case "luty":
                return "lutego";
            case "marzec":
                return "marca";
            case "kwiecień":
                return "kwietnia";
            case "maj":
                return "maja";
            case "czerwiec":
                return "czerwca";
            case "lipiec":
                return "lipca";
            case "sierpień":
                return "sierpnia";
            case "wrzesień":
                return "września";
            case "październik":
                return "października";
            case "listopad":
                return "listopada";
            case "grudzień":
                return "grudnia";
            default:
                return month;
        }
    }
}
