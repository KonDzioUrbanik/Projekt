package com.pansgroup.projectbackend.module.schedule;

import lombok.Getter;

@Getter
public enum WeekType {
    ALL("Każdy tydzień"),
    WEEK_A("Tydzień A"),
    WEEK_B("Tydzień B");

    private final String displayName;

    WeekType(String displayName) {
        this.displayName = displayName;
    }
}
