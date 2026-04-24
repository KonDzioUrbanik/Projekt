package com.pansgroup.projectbackend.module.groupdrive;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import org.springframework.data.repository.query.Param;

@Repository
public interface GroupDriveFileRepository extends JpaRepository<GroupDriveFile, Long> {

    @org.springframework.data.jpa.repository.Query(value = "SELECT f FROM GroupDriveFile f " +
            "JOIN FETCH f.uploader u " +
            "WHERE f.studentGroup = :group " +
            "AND (:category IS NULL OR f.category = :category) " +
            "AND (:search IS NULL OR f.fileName ILIKE :search " +
            "OR u.firstName ILIKE :search " +
            "OR u.lastName ILIKE :search)",
            countQuery = "SELECT COUNT(f) FROM GroupDriveFile f " +
            "WHERE f.studentGroup = :group " +
            "AND (:category IS NULL OR f.category = :category) " +
            "AND (:search IS NULL OR f.fileName ILIKE :search " +
            "OR f.uploader.firstName ILIKE :search " +
            "OR f.uploader.lastName ILIKE :search)")
    Page<GroupDriveFile> findByGroupAndFilters(@Param("group") StudentGroup group,
            @Param("category") FileCategory category, @Param("search") String search, Pageable pageable);

    List<GroupDriveFile> findByStudentGroupAndIsDeletedFalse(StudentGroup studentGroup);

    long countByUploaderAndIsDeletedFalse(User uploader);

    @org.springframework.data.jpa.repository.Query("SELECT SUM(f.fileSize) FROM GroupDriveFile f WHERE f.isDeleted = false AND f.studentGroup.id = :groupId")
    Long sumSizeByGroupAndDeletedFalse(@Param("groupId") Long groupId);

    @org.springframework.data.jpa.repository.Query("SELECT SUM(f.fileSize) FROM GroupDriveFile f WHERE f.isDeleted = false AND f.uploader.id = :userId")
    Long sumSizeByUploaderAndDeletedFalse(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE GroupDriveFile f SET f.downloadCount = f.downloadCount + 1 WHERE f.id = :id")
    void incrementDownloadCount(@Param("id") Long id);

    List<GroupDriveFile> findByIsDeletedTrueAndDeletedAtBefore(java.time.LocalDateTime cutoffDate);
}
