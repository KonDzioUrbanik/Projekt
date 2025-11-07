package com.pansgroup.projectbackend.exception;

public class AlbumNumberAlreadyExistsException extends RuntimeException {
    public AlbumNumberAlreadyExistsException(Integer nrAlbumu) {
        super("Użytkownik z tym numerem albumu: \n" + nrAlbumu+"  już istnieje");
    }
}

//TODO()
