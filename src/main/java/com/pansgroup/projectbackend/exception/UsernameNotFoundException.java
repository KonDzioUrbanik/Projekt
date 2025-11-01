package com.pansgroup.projectbackend.exception;

public class UsernameNotFoundException extends RuntimeException {
    public UsernameNotFoundException(String message) {
        super( "Błąd nie znaleziono takiego emaila " + message);
    }
}
