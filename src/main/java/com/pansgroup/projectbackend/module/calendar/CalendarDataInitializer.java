package com.pansgroup.projectbackend.module.calendar;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class CalendarDataInitializer implements CommandLineRunner {

        private final CalendarEventRepository calendarEventRepository;

        public CalendarDataInitializer(CalendarEventRepository calendarEventRepository) {
                this.calendarEventRepository = calendarEventRepository;
        }

        @Override
        public void run(String... args) throws Exception {
                initializeDefaultEvents();
        }

        private void initializeDefaultEvents() {
                // SEMESTR ZIMOWY
                createEventIfMissing("Zajęcia dydaktyczne", "2025-10-01", "2025-12-21", CalendarEventType.DIDACTIC);

                // Dni wolne / Przerwa świąteczna (CZERWONY)
                createEventIfMissing("Przerwa świąteczna", "2025-12-22", "2026-01-06", CalendarEventType.HOLIDAY);

                createEventIfMissing("Zajęcia dydaktyczne", "2026-01-07", "2026-01-31", CalendarEventType.DIDACTIC);

                // Sesje (NIEBIESKI)
                createEventIfMissing("Zimowa sesja egzaminacyjna", "2026-02-01", "2026-02-10", CalendarEventType.EXAM);
                createEventIfMissing("Poprawkowa sesja egzaminacyjna", "2026-02-16", "2026-02-22",
                                CalendarEventType.EXAM);

                // Przerwa międzysemestralna (FIOLETOWY - BREAK)
                createEventIfMissing("Przerwa międzysemestralna", "2026-02-11", "2026-02-15", CalendarEventType.BREAK);

                // Zmiany w planie (ZIELONY)
                createEventIfMissing("Zajęcia poniedziałkowe z tyg. A", "2025-11-12", "2025-11-12",
                                CalendarEventType.SCHEDULE_CHANGE);
                createEventIfMissing("Zajęcia wtorkowe z tyg. A", "2026-01-29", "2026-01-29",
                                CalendarEventType.SCHEDULE_CHANGE);
                createEventIfMissing("Zajęcia wtorkowe z tyg. A", "2026-01-30", "2026-01-30",
                                CalendarEventType.SCHEDULE_CHANGE);

                // SEMESTR LETNI
                createEventIfMissing("Zajęcia dydaktyczne", "2026-02-23", "2026-04-02", CalendarEventType.DIDACTIC);

                // Przerwa świąteczna Wielkanocna (CZERWONY)
                createEventIfMissing("Przerwa świąteczna", "2026-04-03", "2026-04-07", CalendarEventType.HOLIDAY);

                createEventIfMissing("Zajęcia dydaktyczne", "2026-04-08", "2026-06-15", CalendarEventType.DIDACTIC);

                // Sesje (NIEBIESKI)
                createEventIfMissing("Letnia sesja egzaminacyjna", "2026-06-16", "2026-06-28", CalendarEventType.EXAM);
                createEventIfMissing("Poprawkowa sesja egzaminacyjna", "2026-09-14", "2026-09-20",
                                CalendarEventType.EXAM);

                // Wakacje (FIOLETOWY - BREAK)
                createEventIfMissing("Przerwa wakacyjna", "2026-06-29", "2026-09-30", CalendarEventType.BREAK);

                // Zmiany w planie (ZIELONY) - Semestr Letni
                createEventIfMissing("Zajęcia piątkowe z tyg. B", "2026-06-10", "2026-06-10",
                                CalendarEventType.SCHEDULE_CHANGE);
                createEventIfMissing("Zajęcia sobotnie z tyg. B", "2026-06-15", "2026-06-15",
                                CalendarEventType.SCHEDULE_CHANGE);
        }

        private void createEventIfMissing(String title, String from, String to, CalendarEventType type) {
                LocalDate dateFrom = LocalDate.parse(from);
                LocalDate dateTo = LocalDate.parse(to);

                // Proste sprawdzanie po tytule i dacie staru, aby uniknąć duplikatów
                boolean exists = calendarEventRepository.findAll().stream()
                                .anyMatch(e -> e.getTitle().equals(title) && e.getDateFrom().equals(dateFrom));

                if (!exists) {
                        CalendarEvent event = CalendarEvent.builder()
                                        .title(title)
                                        .dateFrom(dateFrom)
                                        .dateTo(dateTo)
                                        .type(type)
                                        .build();
                        calendarEventRepository.save(event);
                }
        }
}
