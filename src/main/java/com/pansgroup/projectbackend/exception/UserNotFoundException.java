package com.pansgroup.projectbackend.exception;

public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(Long id) {
        super("Użytkownik o id " + id + " nie istnieje.");
    }
    public UserNotFoundException(String message) {
        super(message);
    }
}

