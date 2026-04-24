package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.module.forum.dto.ForumCommentCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumCommentResponseDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumCommentUpdateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadModerationDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadResponseDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadUpdateDto;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

public interface ForumService {

    List<ForumThreadResponseDto> getFeed(boolean includeArchived);

    ForumThreadResponseDto getThread(Long id);

    ForumThreadResponseDto createThread(ForumThreadCreateDto dto, List<MultipartFile> files);

    ForumThreadResponseDto addComment(Long threadId, ForumCommentCreateDto dto, List<MultipartFile> files);

    ForumThreadResponseDto updateThread(Long id, ForumThreadUpdateDto dto);

    ForumThreadResponseDto updateComment(Long threadId, Long commentId, ForumCommentUpdateDto dto);

    void deleteThread(Long id);

    ForumThreadResponseDto deleteComment(Long threadId, Long commentId);

    ForumThreadResponseDto voteThread(Long id, String voteType); // "UPVOTE" or "DOWNVOTE"

    ForumThreadResponseDto voteComment(Long threadId, Long commentId, String voteType); // "UPVOTE" or "DOWNVOTE"

    ForumThreadResponseDto moderateThread(Long id, ForumThreadModerationDto dto);

    List<ForumThreadResponseDto> getUserThreads(Long userId);

    List<ForumCommentResponseDto> getUserComments(Long userId);

    Map<String, Long> getUserForumStats(Long userId);

    ForumThreadAttachment getAttachmentWithAccessCheck(Long attachmentId);

    ForumCommentAttachment getCommentAttachmentWithAccessCheck(Long attachmentId);
}



