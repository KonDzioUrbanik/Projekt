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

    /** Starosta – create announcement for own group */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AnnouncementResponseDto create(@Valid @RequestBody AnnouncementCreateDto dto) {
        return announcementService.createForOwnGroup(dto);
    }

    /** Student / Starosta – get announcements for their group */
    @GetMapping("/group")
    public List<AnnouncementResponseDto> announcementFeed() {
        return announcementService.getCurrentUserGroupFeed();
    }

    /** Admin – get ALL announcements across all groups */
    @GetMapping("/all")
    public List<AnnouncementResponseDto> getAllAnnouncements() {
        return announcementService.getAllAnnouncements();
    }

    /** Admin / Starosta (own) – delete an announcement by ID */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        announcementService.deleteById(id);
    }
}
