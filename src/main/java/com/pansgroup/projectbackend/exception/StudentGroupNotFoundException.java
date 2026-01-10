package com.pansgroup.projectbackend.exception;

public class StudentGroupNotFoundException extends RuntimeException {
    public StudentGroupNotFoundException(String message) {
        super("Kierunek o nazwie '" + message + "' nie istnieje.");
    }
    public StudentGroupNotFoundException(Long id) {
        super("Kierunek o id '" + id + "' nie istnieje.");
    }
}
