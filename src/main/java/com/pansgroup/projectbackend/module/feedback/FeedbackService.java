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
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final com.pansgroup.projectbackend.module.user.UserRepository userRepository;
    private final com.pansgroup.projectbackend.module.system.AdminSecurityAuditService securityAuditService;
    private final org.apache.tika.Tika tika;

    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList("jpg", "jpeg", "png", "pdf");

    @Transactional
    public Feedback createFeedback(FeedbackDto dto, MultipartFile file) {
        Long authenticatedUserId = null;
        String email = dto.getEmail();

        // Capture authenticated user if present
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            String username = auth.getName();
            var userOpt = userRepository.findByEmail(username.toLowerCase());
            if (userOpt.isPresent()) {
                var user = userOpt.get();
                authenticatedUserId = user.getId();
                // If user is logged in, ensure we use their account email if none provided
                if (email == null || email.trim().isEmpty()) {
                    email = user.getEmail();
                }
            }
        }

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

                // Magic Bytes Verification (Apache Tika)
                try (java.io.InputStream is = new java.io.ByteArrayInputStream(attachmentData)) {
                    String detectedMime = tika.detect(is);
                    boolean isImage = detectedMime.startsWith("image/");
                    boolean isPdf = "application/pdf".equals(detectedMime);

                    if (!isImage && !isPdf) {
                        securityAuditService.recordEvent("FEEDBACK_FILE_REJECTED", null, 
                            "Próba wgrania złośliwego pliku udającego obraz/PDF: " + filename + " (Wykryto: " + detectedMime + ")", 
                            authenticatedUserId, email);
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                            "Przesłany plik nie jest prawdziwym obrazem ani dokumentem PDF (wykryto: " + detectedMime + ")");
                    }
                }
            } catch (java.io.IOException e) {
                throw new RuntimeException("Błąd podczas przetwarzania załącznika", e);
            }
        }

        Feedback feedback = Feedback.builder()
                .type(dto.getType())
                .title(Jsoup.clean(dto.getTitle() != null ? dto.getTitle() : "", Safelist.none()))
                .description(Jsoup.clean(dto.getDescription() != null ? dto.getDescription() : "", Safelist.relaxed()))
                .email(email)
                .userId(authenticatedUserId)
                .url(dto.getUrl())
                .userAgent(dto.getUserAgent())
                .status(FeedbackStatus.OPEN)
                .attachmentData(attachmentData)
                .contentType(contentType)
                .originalFileName(originalFileName)
                .createdAt(LocalDateTime.now())
                .build();
        Feedback savedFeedback = feedbackRepository.save(feedback);
        if (file != null && !file.isEmpty()) {
            securityAuditService.recordEvent("FEEDBACK_UPLOAD", null, 
                "Wgrano załącznik do opinii: " + originalFileName, authenticatedUserId, email);
        }
        return savedFeedback;
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
