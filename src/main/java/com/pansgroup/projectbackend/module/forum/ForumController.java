package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.module.forum.dto.ForumCommentCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumCommentUpdateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadModerationDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadResponseDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadUpdateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumCommentResponseDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/forum")
public class ForumController {

    private final ForumService forumService;

    public ForumController(ForumService forumService) {
        this.forumService = forumService;
    }

    @GetMapping("/threads")
    public List<ForumThreadResponseDto> feed(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return forumService.getFeed(includeArchived);
    }

    @GetMapping("/threads/{id}")
    public ForumThreadResponseDto thread(@PathVariable Long id) {
        return forumService.getThread(id);
    }

    @PostMapping("/threads")
    @ResponseStatus(HttpStatus.CREATED)
    public ForumThreadResponseDto createThread(
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam(required = false) Long targetGroupId,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        ForumThreadCreateDto dto = new ForumThreadCreateDto(title, content, targetGroupId);
        return forumService.createThread(dto, files);
    }

    @PostMapping("/threads/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public ForumThreadResponseDto addComment(
            @PathVariable Long id,
            @RequestParam String content,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        ForumCommentCreateDto dto = new ForumCommentCreateDto(content);
        return forumService.addComment(id, dto, files);
    }

    @PutMapping("/threads/{id}")
    public ForumThreadResponseDto updateThread(@PathVariable Long id, @Valid @RequestBody ForumThreadUpdateDto dto) {
        return forumService.updateThread(id, dto);
    }

    @PutMapping("/threads/{threadId}/comments/{commentId}")
    public ForumThreadResponseDto updateComment(@PathVariable Long threadId,
                                                @PathVariable Long commentId,
                                                @Valid @RequestBody ForumCommentUpdateDto dto) {
        return forumService.updateComment(threadId, commentId, dto);
    }

    @DeleteMapping("/threads/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteThread(@PathVariable Long id) {
        forumService.deleteThread(id);
    }

    @DeleteMapping("/threads/{threadId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable Long threadId, @PathVariable Long commentId) {
        forumService.deleteComment(threadId, commentId);
    }

    @PostMapping("/threads/{id}/vote")
    public ForumThreadResponseDto voteThread(@PathVariable Long id, @RequestParam String voteType) {
        return forumService.voteThread(id, voteType);
    }

    @PostMapping("/threads/{threadId}/comments/{commentId}/vote")
    public ForumThreadResponseDto voteComment(
            @PathVariable Long threadId,
            @PathVariable Long commentId,
            @RequestParam String voteType) {
        return forumService.voteComment(threadId, commentId, voteType);
    }

    @PatchMapping("/threads/{id}/moderation")
    public ForumThreadResponseDto moderateThread(@PathVariable Long id, @RequestBody ForumThreadModerationDto dto) {
        return forumService.moderateThread(id, dto);
    }

    @GetMapping("/users/{userId}/threads")
    public List<ForumThreadResponseDto> getUserThreads(@PathVariable Long userId) {
        return forumService.getUserThreads(userId);
    }

    @GetMapping("/users/{userId}/comments")
    public List<ForumCommentResponseDto> getUserComments(@PathVariable Long userId) {
        return forumService.getUserComments(userId);
    }

    @GetMapping("/users/{userId}/stats")
    public Map<String, Long> getUserForumStats(@PathVariable Long userId) {
        return forumService.getUserForumStats(userId);
    }

    @GetMapping("/attachments/{attachmentId}")
    public ResponseEntity<byte[]> getThreadAttachment(@PathVariable Long attachmentId) {
        ForumThreadAttachment attachment = forumService.getAttachmentWithAccessCheck(attachmentId);
        return ResponseEntity.ok()
                .header("Content-Type", attachment.getContentType())
                .header("Content-Disposition", "attachment; filename=\"" + attachment.getOriginalFileName() + "\"")
                .body(attachment.getFileData());
    }

    @GetMapping("/comments/attachments/{attachmentId}")
    public ResponseEntity<byte[]> getCommentAttachment(@PathVariable Long attachmentId) {
        ForumCommentAttachment attachment = forumService.getCommentAttachmentWithAccessCheck(attachmentId);
        return ResponseEntity.ok()
                .header("Content-Type", attachment.getContentType())
                .header("Content-Disposition", "attachment; filename=\"" + attachment.getOriginalFileName() + "\"")
                .body(attachment.getFileData());
    }
}



