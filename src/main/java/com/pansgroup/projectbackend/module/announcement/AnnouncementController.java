package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementCreateDto;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementResponseDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AnnouncementResponseDto create(@Valid @RequestBody AnnouncementCreateDto dto) {
        return announcementService.createForOwnGroup(dto);
    }

    @GetMapping("/group")
    public List<AnnouncementResponseDto> announcementFeed() {
        return announcementService.getCurrentUserGroupFeed();
    }

    @GetMapping("/all")
    public List<AnnouncementResponseDto> allAnnouncements() {
        return announcementService.getAllAnnouncements();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        announcementService.deleteById(id);
    }

    @PostMapping("/{id}/confirm-read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmRead(@PathVariable Long id) {
        announcementService.confirmRead(id);
    }
}
