package com.pansgroup.projectbackend.exception;

public class EmailAlreadyExistsException extends RuntimeException {
    public EmailAlreadyExistsException(String email) {
        super("Użytkownik z adresem e-mail " + email + " jest już zarejestrowany w systemie. Jeśli zapomniałeś hasła, skorzystaj z funkcji odzyskiwania hasła.");
    }
}
