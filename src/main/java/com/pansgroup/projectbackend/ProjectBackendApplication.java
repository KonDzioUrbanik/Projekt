package com.pansgroup.projectbackend;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableScheduling
@EnableAsync
@EnableCaching
public class ProjectBackendApplication {

    public static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Warsaw"));

        SpringApplication.run(ProjectBackendApplication.class, args);
    }

    @org.springframework.context.annotation.Bean
    public org.apache.tika.Tika tika() {
        return new org.apache.tika.Tika();
    }
}
