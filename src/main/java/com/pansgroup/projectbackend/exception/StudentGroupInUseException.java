package com.pansgroup.projectbackend.exception;

public class StudentGroupInUseException extends RuntimeException {
    public StudentGroupInUseException(String message) {
        super(message);
    }
}
