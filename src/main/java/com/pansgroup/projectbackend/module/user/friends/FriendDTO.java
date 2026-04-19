package com.pansgroup.projectbackend.module.user.friends;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class FriendDTO {
    private Long id;
    private Long userId;
    private String fullName;
    private String email;
    private String fieldOfStudy;
    private Integer yearOfStudy;
    private boolean hasAvatar;
}
