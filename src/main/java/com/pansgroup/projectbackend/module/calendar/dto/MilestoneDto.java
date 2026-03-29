package com.pansgroup.projectbackend.module.calendar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MilestoneDto {
    private String label;
    private double progress;
    private String date;
}
