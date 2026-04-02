package com.pansgroup.projectbackend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.FORBIDDEN)
public class RegistrationDisabledException extends RuntimeException {
    public RegistrationDisabledException() {
        super("Rejestracja nowych kont jest obecnie wyłączona ze względów bezpieczeństwa lub prac konserwacyjnych.");
    }
}
