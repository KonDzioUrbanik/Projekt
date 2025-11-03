package com.pansgroup.projectbackend.exception;

public class ScheduleEntryNotFoundException extends RuntimeException {
    public ScheduleEntryNotFoundException(Long id) {
        super("Wpis w planie zajęć o " + id + " nie istnieje.");
    }
}
