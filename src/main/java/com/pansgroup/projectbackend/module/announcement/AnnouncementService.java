package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementCreateDto;
import com.pansgroup.projectbackend.module.announcement.dto.AnnouncementResponseDto;

import java.util.List;

public interface AnnouncementService {
    AnnouncementResponseDto createForOwnGroup(AnnouncementCreateDto dto);

    List<AnnouncementResponseDto> getCurrentUserGroupFeed();

    List<AnnouncementResponseDto> getAllAnnouncements();

    void deleteById(Long id);
}
