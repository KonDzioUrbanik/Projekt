package com.pansgroup.projectbackend.module.forum;

import com.pansgroup.projectbackend.module.forum.dto.ForumCommentCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumCommentResponseDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumCommentUpdateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadCreateDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadModerationDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadResponseDto;
import com.pansgroup.projectbackend.module.forum.dto.ForumThreadUpdateDto;

import java.util.List;

public interface ForumService {

    List<ForumThreadResponseDto> getFeed(boolean includeArchived);

    ForumThreadResponseDto getThread(Long id);

    ForumThreadResponseDto createThread(ForumThreadCreateDto dto);

    ForumThreadResponseDto addComment(Long threadId, ForumCommentCreateDto dto);

    ForumThreadResponseDto updateThread(Long id, ForumThreadUpdateDto dto);

    ForumThreadResponseDto updateComment(Long threadId, Long commentId, ForumCommentUpdateDto dto);

    void deleteThread(Long id);

    void deleteComment(Long threadId, Long commentId);

    ForumThreadResponseDto toggleThreadLike(Long id);

    ForumThreadResponseDto moderateThread(Long id, ForumThreadModerationDto dto);

    List<ForumThreadResponseDto> getUserThreads(Long userId);

    List<ForumCommentResponseDto> getUserComments(Long userId);

    java.util.Map<String, Long> getUserForumStats(Long userId);
}



