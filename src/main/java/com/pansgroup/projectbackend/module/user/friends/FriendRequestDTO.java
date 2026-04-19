package com.pansgroup.projectbackend.module.user.friends;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class FriendRequestDTO {
    private Long requestId;
    private Long senderId;
    private String senderName;
    private String senderEmail;
    private LocalDateTime sentAt;
}
