package com.pansgroup.projectbackend.exception;

public class StudentGroupAlreadyExistsException extends RuntimeException {
    public StudentGroupAlreadyExistsException(String message) {
        super(message);
    }
}