package com.pansgroup.projectbackend.module.groupdrive;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "group_drive_files", indexes = {
    @Index(name = "idx_group_deleted", columnList = "student_group_id, is_deleted"),
    @Index(name = "idx_category", columnList = "category"),
    @Index(name = "idx_upload_date", columnList = "uploadDate")
})
@SQLRestriction("is_deleted = false")
public class GroupDriveFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String fileName;

    @Basic(fetch = FetchType.LAZY)
    @Lob
    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "file_data", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private byte[] fileData;

    @Column(nullable = false)
    private Long fileSize;

    @Column(nullable = false, length = 100)
    private String mimeType;

    @Column(length = 64)
    private String checksum;

    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploader_id", nullable = false)
    private User uploader;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_group_id", nullable = false)
    private StudentGroup studentGroup;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private FileCategory category;

    @Column(nullable = false)
    private boolean isDeleted = false;

    private LocalDateTime deletedAt;

    @Column(nullable = false)
    private Long downloadCount = 0L;

    @PrePersist
    protected void onCreate() {
        this.uploadDate = LocalDateTime.now();
    }
}
