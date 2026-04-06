package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.module.forum.dto.ForumCommentCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumCommentUpdateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadModerationDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadResponseDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    public ForumThreadResponseDto createThread(@Valid @RequestBody ForumThreadCreateDto dto) {
        return forumService.createThread(dto);
    }

    @PostMapping("/threads/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public ForumThreadResponseDto addComment(@PathVariable Long id, @Valid @RequestBody ForumCommentCreateDto dto) {
        return forumService.addComment(id, dto);
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

    @PostMapping("/threads/{id}/like")
    public ForumThreadResponseDto toggleLike(@PathVariable Long id) {
        return forumService.toggleThreadLike(id);
    }

    @PatchMapping("/threads/{id}/moderation")
    public ForumThreadResponseDto moderateThread(@PathVariable Long id, @RequestBody ForumThreadModerationDto dto) {
        return forumService.moderateThread(id, dto);
    }
}



