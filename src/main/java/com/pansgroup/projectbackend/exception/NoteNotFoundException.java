package com.pansgroup.projectbackend.exception;

public class NoteNotFoundException extends RuntimeException {
    public NoteNotFoundException(Long id) {
        super("Notatka o id " + id + " nie istnieje.");
    }
}
