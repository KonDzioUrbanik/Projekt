package com.pansgroup.projectbackend.exception;

public class EmailAlreadyExistsException extends RuntimeException {
    public EmailAlreadyExistsException(String email) {
        super("Użytkownik z e-mailem '" + email + "' już istnieje.");
    }
}
