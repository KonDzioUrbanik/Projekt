package com.pansgroup.projectbackend.module.feedback;

import com.pansgroup.projectbackend.module.feedback.dto.FeedbackDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.Arrays;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;

    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList("jpg", "jpeg", "png", "pdf");

    @Transactional
    public Feedback createFeedback(FeedbackDto dto, MultipartFile file) {
        byte[] attachmentData = null;
        String contentType = null;
        String originalFileName = null;

        if (file != null && !file.isEmpty()) {
            String filename = StringUtils.cleanPath(file.getOriginalFilename());
            String extension = StringUtils.getFilenameExtension(filename);

            if (extension == null || !ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Niedozwolone rozszerzenie pliku: " + extension + ". Dozwolone: jpg, png, pdf.");
            }

            // Basic MIME type check
            String mimeType = file.getContentType();
            if (mimeType == null || (!mimeType.startsWith("image/") && !mimeType.equals("application/pdf"))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Niedozwolony typ pliku: " + mimeType);
            }

            // Size check (redundant to properties but specific message)
            if (file.getSize() > 5 * 1024 * 1024) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plik jest zbyt duży (max 5MB).");
            }

            try {
                attachmentData = file.getBytes();
                contentType = mimeType;
                originalFileName = filename;
            } catch (java.io.IOException e) {
                throw new RuntimeException("Błąd podczas przetwarzania załącznika", e);
            }
        }

        Feedback feedback = Feedback.builder()
                .type(dto.getType())
                .title(dto.getTitle())
                .description(dto.getDescription())
                .email(dto.getEmail())
                .url(dto.getUrl())
                .userAgent(dto.getUserAgent())
                .status(FeedbackStatus.OPEN)
                .attachmentData(attachmentData)
                .contentType(contentType)
                .originalFileName(originalFileName)
                .createdAt(LocalDateTime.now())
                .build();

        return feedbackRepository.save(feedback);
    }

    @Transactional(readOnly = true)
    public List<Feedback> getAllFeedback() {
        return feedbackRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public Feedback updateStatus(Long id, FeedbackStatus status) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Feedback not found with id: " + id));

        feedback.setStatus(status);
        return feedbackRepository.save(feedback);
    }

    @Transactional
    public Feedback updateAdminComment(Long id, String comment) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Feedback not found with id: " + id));

        feedback.setAdminComment(comment);
        return feedbackRepository.save(feedback);
    }

    @Transactional(readOnly = true)
    public Feedback getFeedbackWithAttachment(Long id) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Feedback not found with id: " + id));

        if (feedback.getAttachmentData() == null) {
            throw new RuntimeException("Feedback has no attachment");
        }

        return feedback;
    }

    @Transactional
    public void deleteFeedback(Long id) {
        feedbackRepository.deleteById(id);
    }
}
