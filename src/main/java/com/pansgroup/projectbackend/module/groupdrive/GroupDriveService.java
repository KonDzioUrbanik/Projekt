package com.pansgroup.projectbackend.module.groupdrive;

import com.pansgroup.projectbackend.module.student.StudentGroup;
import com.pansgroup.projectbackend.module.student.StudentGroupRepository;
import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import com.pansgroup.projectbackend.security.SecurityRoles;
import org.apache.tika.Tika;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.context.event.EventListener;
import com.pansgroup.projectbackend.module.user.event.UserDeletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroupDriveService {

    private final GroupDriveFileRepository groupDriveFileRepository;
    private final UserRepository userRepository;
    private final StudentGroupRepository studentGroupRepository;
    private final Tika tika;
    private final com.pansgroup.projectbackend.module.system.AdminSecurityAuditService securityAuditService;

    public Page<GroupDriveFile> getFilesForUserGroup(User user, FileCategory category, String search,
            Pageable pageable) {
        StudentGroup group = user.getStudentGroup();
        if (group == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Użytkownik nie jest przypisany do żadnej grupy.");
        }

        String searchPattern = (search != null && !search.trim().isEmpty())
                ? "%" + search.trim().toLowerCase() + "%"
                : null;

        return groupDriveFileRepository.findByGroupAndFilters(group, category, searchPattern, pageable);
    }

    @Transactional
    public GroupDriveFile uploadFile(User user, MultipartFile file, FileCategory category) {
        // Guard Clauses
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank() || originalFilename.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Zła nazwa pliku lub jej długość przekracza 255 znaków.");
        }
        StudentGroup group = user.getStudentGroup();
        if (group == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Użytkownik nie posiada przypisanej grupy studenckiej.");
        }

        long fileSize = file.getSize();
        if (fileSize > 31457280L) { // 30MB
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "Przesłany plik przekracza limit wielkości (30 MB).");
        }

        // Limit liczby plików (ochrona przed Resource Exhaustion)
        long activeFilesCount = groupDriveFileRepository.countByUploaderAndIsDeletedFalse(user);
        if (activeFilesCount >= 50) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Osiągnięto limit 50 aktywnych plików. Usuń stare pliki, aby wgrać nowe.");
        }

        Long userId = user.getId();
        Long groupId = group.getId();

        if (userRepository.incrementUsedStorage(userId, fileSize) == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Przekroczono limit miejsca dla twojego konta.");
        }

        if (studentGroupRepository.incrementUsedStorage(groupId, fileSize) == 0) {
            userRepository.decrementUsedStorage(userId, fileSize);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Przekroczono limit miejsca dla twojego kierunku studenckiego.");
        }

        try {
            byte[] fileData = file.getBytes();

            // MIME Detection
            String detectedMime;
            try (java.io.InputStream is = new java.io.ByteArrayInputStream(fileData)) {
                detectedMime = tika.detect(is);
                if (detectedMime.contains(";")) {
                    detectedMime = detectedMime.split(";")[0];
                }
            }

            // MD5 Checksum
            String md5Checksum;
            try {
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("MD5");
                byte[] digest = md.digest(fileData);
                StringBuilder sb = new StringBuilder();
                for (byte b : digest) {
                    sb.append(String.format("%02x", b));
                }
                md5Checksum = sb.toString();
            } catch (java.security.NoSuchAlgorithmException e) {
                md5Checksum = null;
            }

            // DB Record
            GroupDriveFile driveFile = new GroupDriveFile();
            driveFile.setFileName(originalFilename);
            driveFile.setFileData(fileData);
            driveFile.setFileSize(fileSize);
            driveFile.setMimeType(detectedMime);
            driveFile.setChecksum(md5Checksum);
            driveFile.setUploader(user);
            driveFile.setStudentGroup(group);
            driveFile.setCategory(category != null ? category : FileCategory.OTHER);
            driveFile.setUploadDate(java.time.LocalDateTime.now());

            GroupDriveFile saved = groupDriveFileRepository.save(driveFile);
            groupDriveFileRepository.flush(); // Ensure SUM query sees this file

            // Przeliczanie kwoty dopiero po sukcesie transakcji zapisu
            recalculateQuota(user, group);

            securityAuditService.recordEvent("DRIVE_UPLOAD", null,
                    "Wgrano plik: " + originalFilename + " (" + detectedMime + ")", user.getId(), user.getEmail());

            return saved;

        } catch (Exception e) {
            log.error("CRITICAL: Upload flow failed at DB persistence phase. Initiating compensation.", e);

            // COMPENSATION: Fallback Quotas
            studentGroupRepository.decrementUsedStorage(groupId, fileSize);
            userRepository.decrementUsedStorage(userId, fileSize);

            if (e instanceof ResponseStatusException)
                throw (ResponseStatusException) e;
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Błąd serwera podczas zapisywania pliku w bazie danych. Zmiany zostały wycofane.", e);
        }
    }

    @Transactional
    public GroupDriveFile getFileForDownload(Long fileId, User user) {
        GroupDriveFile file = groupDriveFileRepository.findById(java.util.Objects.requireNonNull(fileId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plik nie istnieje."));

        if (file.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Plik został usunięty.");
        }

        if (user.getStudentGroup() == null || file.getStudentGroup() == null
                || !file.getStudentGroup().getId().equals(user.getStudentGroup().getId())) {
            securityAuditService.recordEvent("DRIVE_IDOR_ATTEMPT", null,
                    "Próba nieautoryzowanego pobrania pliku ID: " + fileId + " przez użytkownika z innej grupy.",
                    user.getId(), user.getEmail());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brak dostępu do pliku innej grupy studenckiej.");
        }

        // Inkrementacja licznika uzyc pliku (Atomic)
        groupDriveFileRepository.incrementDownloadCount(file.getId());

        return file;

    }

    @Transactional
    public void deleteFile(Long fileId, User user) {
        GroupDriveFile file = groupDriveFileRepository.findById(java.util.Objects.requireNonNull(fileId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plik nie istnieje."));

        if (file.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plik już został trwale usunięty.");
        }

        boolean isUploader = file.getUploader().getId().equals(user.getId());
        boolean isStarosta = SecurityRoles.ROLE_STAROSTA.equals(user.getRole()) && user.getStudentGroup() != null
                && user.getStudentGroup().getId().equals(file.getStudentGroup().getId());
        boolean isAdmin = SecurityRoles.ROLE_ADMIN.equals(user.getRole());

        if (!isUploader && !isStarosta && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Nie masz uprawnień do usunięcia tego pliku.");
        }

        // Soft delete Logic
        file.setDeleted(true);
        file.setDeletedAt(LocalDateTime.now());
        groupDriveFileRepository.saveAndFlush(file); // Ensure SUM query ignores this file

        // Wycofywanie zajętości atomicznymi zapytaniami bez narzucania Race-Conditions
        User uploader = file.getUploader();
        StudentGroup group = file.getStudentGroup();

        userRepository.decrementUsedStorage(uploader.getId(), file.getFileSize());
        studentGroupRepository.decrementUsedStorage(group.getId(), file.getFileSize());

        // Sync quotas after deletion to ensure no negative values or drift persists
        recalculateQuota(uploader, group);

        securityAuditService.recordEvent("DRIVE_FILE_DELETED", null,
                "Usunięto plik: " + file.getFileName() + " (ID: " + fileId + ")", user.getId(), user.getEmail());
    }

    @Transactional
    public void recalculateQuota(User user, StudentGroup group) {
        if (user != null && user.getId() != null) {
            // Fetch fresh to avoid stale data/detach issues
            userRepository.findById(user.getId()).ifPresent(freshUser -> {
                Long totalUsedByUser = groupDriveFileRepository.sumSizeByUploaderAndDeletedFalse(freshUser.getId());
                long newUsed = (totalUsedByUser != null) ? totalUsedByUser : 0L;
                log.debug("Quota Sync [User:{}]: Old={}, New={}", freshUser.getEmail(), freshUser.getUsedStorage(),
                        newUsed);
                freshUser.setUsedStorage(newUsed);
                userRepository.saveAndFlush(freshUser);
            });
        }
        if (group != null && group.getId() != null) {
            studentGroupRepository.findById(group.getId()).ifPresent(freshGroup -> {
                Long totalUsedByGroup = groupDriveFileRepository.sumSizeByGroupAndDeletedFalse(freshGroup.getId());
                long newUsed = (totalUsedByGroup != null) ? totalUsedByGroup : 0L;
                log.debug("Quota Sync [Group:{}]: Old={}, New={}", freshGroup.getName(), freshGroup.getUsedStorage(),
                        newUsed);
                freshGroup.setUsedStorage(newUsed);
                studentGroupRepository.saveAndFlush(freshGroup);
            });
        }
    }

    @EventListener
    @Transactional
    public void onUserDeleted(UserDeletedEvent event) {
        Long userId = event.getUser().getId();

        // 1. Soft-delete wszystkich plików
        groupDriveFileRepository.softDeleteByUploaderId(userId, LocalDateTime.now());
        
        // 2. ODPIĘCIE Klucza obcego! Bez tego baza nie pozwoli usunąć usera.
        groupDriveFileRepository.detachUploader(userId);

        userRepository.findById(userId).ifPresent(user -> {
            user.setUsedStorage(0L);
            userRepository.saveAndFlush(user);
        });

        log.info("[GroupDrive] Soft-deleted and detached files of deleted user ID={}", userId);
    }
}
