package com.pansgroup.projectbackend.module.schedule;

public enum ClassType {
    WYKLAD("Wykład"),
    CWICZENIA("Ćwiczenia laboratoryjne"),
    CWICZENIA_PROJEKTOWE("Ćwiczenia projektowe"),
    LABORATORIUM("Laboratorium"),
    PROJEKT("Projekt zespołowy"),
    SEMINARIUM("Seminarium"),
    KONSULTACJE("Konsultacje");

    private final String displayName;

    ClassType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

