package com.pansgroup.projectbackend.module.announcement;

import com.pansgroup.projectbackend.module.announcement.dto.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AnnouncementService {

    AnnouncementResponseDto createForOwnGroup(AnnouncementCreateDto dto, List<MultipartFile> files);

    List<AnnouncementResponseDto> getCurrentUserGroupFeed();

    List<AnnouncementResponseDto> getAllAnnouncements();

    void deleteById(Long id);

    void confirmRead(Long id);

    List<ReadConfirmationDetailDto> getReadDetails(Long id);

    AnnouncementResponseDto togglePin(Long id);

    void checkAttachmentAccess(AnnouncementAttachment attachment);

    List<AnnouncementResponseDto> getDashboardFeed(int limit);
}
