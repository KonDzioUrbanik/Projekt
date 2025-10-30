package com.pansgroup.projectbackend.exception;

public class BlankFieldException extends RuntimeException {
    private final String field;

    public BlankFieldException(String field) {
        super("Pole '" + field + "' nie może być puste.");
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
