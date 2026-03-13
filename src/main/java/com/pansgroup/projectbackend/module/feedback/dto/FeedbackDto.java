package com.pansgroup.projectbackend.module.feedback.dto;

import lombok.Data;

@Data
public class FeedbackDto {
    private String type;
    private String title;
    private String description;
    private String email;
    private String url;
    private String userAgent;
    private String website; // Honeypot
}
