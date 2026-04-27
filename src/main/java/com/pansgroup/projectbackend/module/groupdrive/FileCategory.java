package com.pansgroup.projectbackend.module.groupdrive;

public enum FileCategory {
    NOTES("Notatki"),
    EXAMS("Kolokwia i egzaminy"),
    PROJECTS("Projekty"),
    SLIDES("Prezentacje"),
    OTHER("Inne");

    private final String displayName;

    FileCategory(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static FileCategory fromString(String category) {
        if (category == null || category.isBlank()) {
            return OTHER;
        }
        try {
            return FileCategory.valueOf(category.toUpperCase());
        } catch (IllegalArgumentException e) {
            return OTHER;
        }
    }
}
