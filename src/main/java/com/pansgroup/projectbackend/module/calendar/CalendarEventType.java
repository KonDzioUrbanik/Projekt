package com.pansgroup.projectbackend.module.calendar;

public enum CalendarEventType {
    DIDACTIC, // Zajęcia dydaktyczne
    BREAK, // Przerwy (np. świąteczne)
    EXAM, // Sesje egzaminacyjne
    HOLIDAY, // Dni wolne / święta
    SCHEDULE_CHANGE, // Zmiana planu (np. środa jako poniedziałek)
    OTHER // Inne (z wyborem koloru)
}
