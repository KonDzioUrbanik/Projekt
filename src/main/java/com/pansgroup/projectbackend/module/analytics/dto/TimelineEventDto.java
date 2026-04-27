package com.pansgroup.projectbackend.module.analytics.dto;

/**
 * Pojedyncze zdarzenie na osi czasu (User Journey).
 * @param time   Pełna data i czas zdarzenia w formacie dd.MM.yyyy HH:mm:ss
 * @param type   Typ zdarzenia (PAGE_VIEW, CLICK, ERROR, ...)
 * @param detail Opis zdarzenia w języku polskim
 * @param icon   Klasa FontAwesome dla ikony na osi czasu
 */
public record TimelineEventDto(
        String time,
        String type,
        String detail,
        String icon
) {}
