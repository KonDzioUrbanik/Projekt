package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.module.announcement.dto.*;
import jakarta.validation.Valid;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;
    private final AnnouncementAttachmentRepository attachmentRepository;

    public AnnouncementController(AnnouncementService announcementService,
                                  AnnouncementAttachmentRepository attachmentRepository) {
        this.announcementService = announcementService;
        this.attachmentRepository = attachmentRepository;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AnnouncementResponseDto create(
            @RequestPart("data") @Valid AnnouncementCreateDto dto,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return announcementService.createForOwnGroup(dto, files != null ? files : List.of());
    }

    @GetMapping("/group")
    public List<AnnouncementResponseDto> announcementFeed() {
        return announcementService.getCurrentUserGroupFeed();
    }

    @GetMapping("/all")
    public List<AnnouncementResponseDto> allAnnouncements() {
        return announcementService.getAllAnnouncements();
    }

    @GetMapping("/dashboard-feed")
    public List<AnnouncementResponseDto> dashboardFeed(@RequestParam(defaultValue = "5") int limit) {
        return announcementService.getDashboardFeed(limit);
    }

    @GetMapping("/count/author/{userId}")
    public long countByAuthor(@PathVariable Long userId) {
        return announcementService.countByAuthorId(userId);
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

    @GetMapping("/{id}/read-details")
    public List<ReadConfirmationDetailDto> readDetails(@PathVariable Long id) {
        return announcementService.getReadDetails(id);
    }

    @PatchMapping("/{id}/pin")
    public AnnouncementResponseDto togglePin(@PathVariable Long id) {
        return announcementService.togglePin(id);
    }

    /**
     * Pobieranie załącznika po ID (dane z bazy – wzorzec jak avatar/feedback).
     * Dostępny tylko dla zalogowanych użytkowników (SecurityConfig).
     */
    @GetMapping("/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadAttachment(@PathVariable Long attachmentId) {
        AnnouncementAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Załącznik nie znaleziony."));

        // Weryfikacja uprawnień (Fix Senior+)
        announcementService.checkAttachmentAccess(attachment);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + attachment.getOriginalFileName() + "\"")
                .contentLength(attachment.getFileSize())
                .body(new ByteArrayResource(attachment.getFileData()));
    }
}
