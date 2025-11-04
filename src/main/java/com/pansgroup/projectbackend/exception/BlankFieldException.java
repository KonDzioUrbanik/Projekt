package com.pansgroup.projectbackend.exception;

import lombok.Getter;

@Getter
public class BlankFieldException extends RuntimeException {
    private final String field;

    public BlankFieldException(String field) {
        super("Pole '" + field + "' nie może być puste.");
        this.field = field;
    }

}
