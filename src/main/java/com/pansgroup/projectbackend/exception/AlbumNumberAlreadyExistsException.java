package com.pansgroup.projectbackend.exception;

public class AlbumNumberAlreadyExistsException extends RuntimeException {
    public AlbumNumberAlreadyExistsException(Integer nrAlbumu) {
        super("Użytkownik z numerem albumu " + nrAlbumu + " jest już zarejestrowany w systemie.");
    }
}

