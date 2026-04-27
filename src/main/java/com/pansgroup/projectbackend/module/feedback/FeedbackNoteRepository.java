package com.pansgroup.projectbackend.module.feedback;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FeedbackNoteRepository extends JpaRepository<FeedbackNote, Long> {
    List<FeedbackNote> findByFeedbackIdOrderByCreatedAtDesc(Long feedbackId);
}
