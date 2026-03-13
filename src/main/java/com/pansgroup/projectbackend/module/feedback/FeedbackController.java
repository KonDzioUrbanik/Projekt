package com.pansgroup.projectbackend.module.feedback;

import com.pansgroup.projectbackend.module.feedback.dto.FeedbackDto;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final Map<String, Long> requestCache = new ConcurrentHashMap<>();

    @PostMapping
    public ResponseEntity<?> submitFeedback(@ModelAttribute FeedbackDto dto,
            @RequestParam(value = "file", required = false) MultipartFile file,
            HttpServletRequest request) {

        // Honeypot Check (Anti-Bot)
        if (dto.getWebsite() != null && !dto.getWebsite().isEmpty()) {
            // Return success to fool the bot, but don't save anything
            return ResponseEntity.ok(Map.of("message", "Feedback submitted successfully"));
        }

        // Rate Limiting (Anti-Spam)
        String clientIp = request.getRemoteAddr();
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null) {
            clientIp = xForwardedFor.split(",")[0];
        }

        long currentTime = System.currentTimeMillis();
        if (requestCache.containsKey(clientIp)) {
            long lastRequestTime = requestCache.get(clientIp);
            if (currentTime - lastRequestTime < 60000) { // 1 minute cooldown
                return ResponseEntity.status(429)
                        .body(Map.of("message", "Zbyt częste zgłoszenia. Spróbuj ponownie za minutę."));
            }
        }
        requestCache.put(clientIp, currentTime);

        // Simple cache cleanup (1% chance)
        if (Math.random() < 0.01) {
            long now = System.currentTimeMillis();
            requestCache.entrySet().removeIf(entry -> now - entry.getValue() > 3600000); // Remove entries older than 1h
        }

        feedbackService.createFeedback(dto, file);
        return ResponseEntity.ok(Map.of("message", "Feedback submitted successfully"));
    }

    @GetMapping
    public ResponseEntity<List<Feedback>> getAllFeedback() {
        return ResponseEntity.ok(feedbackService.getAllFeedback());
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Feedback> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String statusStr = body.get("status");
        FeedbackStatus status = FeedbackStatus.valueOf(statusStr);
        return ResponseEntity.ok(feedbackService.updateStatus(id, status));
    }

    @PutMapping("/{id}/comment")
    public ResponseEntity<Feedback> updateAdminComment(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String comment = body.get("comment");
        return ResponseEntity.ok(feedbackService.updateAdminComment(id, comment));
    }

    @GetMapping("/{id}/attachment")
    public ResponseEntity<Resource> getAttachment(@PathVariable Long id) {
        Feedback feedback = feedbackService.getFeedbackWithAttachment(id);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(feedback.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + feedback.getOriginalFileName() + "\"")
                .body(new org.springframework.core.io.ByteArrayResource(feedback.getAttachmentData()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFeedback(@PathVariable Long id) {
        feedbackService.deleteFeedback(id);
        return ResponseEntity.ok(Map.of("message", "Feedback deleted successfully"));
    }
}
