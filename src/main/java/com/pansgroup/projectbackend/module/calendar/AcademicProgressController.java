package com.pansgroup.projectbackend.module.calendar;

import com.pansgroup.projectbackend.module.calendar.dto.AcademicProgressDto;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AcademicProgressController {

    private final AcademicProgressService academicProgressService;

    @GetMapping("/academic-progress")
    public ResponseEntity<AcademicProgressDto> getProgress(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        
        LocalDate targetDate = (date != null) ? date : LocalDate.now();
        return ResponseEntity.ofNullable(academicProgressService.getProgress(targetDate));
    }
}
