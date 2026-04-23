package com.pansgroup.projectbackend.module.groupdrive;

import com.pansgroup.projectbackend.security.SecurityRoles;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class GroupDriveFileDto {
    private Long id;
    private String fileName;
    private Long fileSize;
    private String mimeType;
    private LocalDateTime uploadDate;
    private String uploaderName;
    private Long uploaderId;
    private String categoryName;
    private String categoryValue;
    private Long downloadCount;

    private boolean canDelete;

    public static GroupDriveFileDto fromEntity(GroupDriveFile file, com.pansgroup.projectbackend.module.user.User currentUser) {
        boolean isSuperAdmin = currentUser != null && SecurityRoles.ROLE_ADMIN.equalsIgnoreCase(currentUser.getRole());
        boolean isOwner = currentUser != null && file.getUploader() != null && currentUser.getId().equals(file.getUploader().getId());

        return GroupDriveFileDto.builder()
                .id(file.getId())
                .fileName(file.getFileName())
                .fileSize(file.getFileSize())
                .mimeType(file.getMimeType())
                .uploadDate(file.getUploadDate())
                .uploaderName(file.getUploader().getFirstName() + " " + file.getUploader().getLastName())
                .uploaderId(file.getUploader().getId())
                .categoryName(file.getCategory() != null ? file.getCategory().getDisplayName() : "Inne")
                .categoryValue(file.getCategory() != null ? file.getCategory().name() : "OTHER")
                .downloadCount(file.getDownloadCount())
                .canDelete(isOwner || isSuperAdmin)
                .build();
    }
}
