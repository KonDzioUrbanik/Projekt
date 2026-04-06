package com.pansgroup.projectbackend.module.forum.dto;

public record ForumThreadModerationDto(
        Boolean locked,
        Boolean archived,
        Boolean pinned
) {
}

