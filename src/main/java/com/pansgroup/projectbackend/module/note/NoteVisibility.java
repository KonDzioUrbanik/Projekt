package com.pansgroup.projectbackend.module.note;

public enum NoteVisibility {
    PRIVATE,           // Tylko autor
    SHARED_WITH_USERS, // Wybrani użytkownicy
    GROUP,             // Cały kierunek (np. Informatyka III stacjonarnie)
    PUBLIC             // Wszyscy użytkownicy w systemie
}
