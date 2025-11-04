package com.pansgroup.projectbackend.exception;

public class StudentGroupNotFoundException extends RuntimeException {
    public StudentGroupNotFoundException(String message) {
        super("Grupa o nazwie '" + message + "' nie istnieje.");
    }
}
