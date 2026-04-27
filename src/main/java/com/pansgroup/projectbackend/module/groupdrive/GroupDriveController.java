package com.pansgroup.projectbackend.module.groupdrive;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/drive")
@RequiredArgsConstructor
public class GroupDriveController {

    private final GroupDriveService groupDriveService;
    private final UserRepository userRepository;

    @GetMapping("/files")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<GroupDriveFileDto>> getFiles(
            Authentication authentication,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(defaultValue = "uploadDate") String sortField,
            @RequestParam(defaultValue = "desc") String sortDirection) {

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        FileCategory cat = (category != null && !category.isBlank()) ? FileCategory.fromString(category) : null;

        Sort.Direction direction = sortDirection.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortField));

        Page<GroupDriveFile> files = groupDriveService.getFilesForUserGroup(user, cat, search, pageable);
        return ResponseEntity.ok(files.map(f -> GroupDriveFileDto.fromEntity(f, user)));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<GroupDriveFileDto> uploadFile(
            Authentication authentication,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", required = false) String category) {

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        FileCategory cat = FileCategory.fromString(category);

        try {
            GroupDriveFile driveFile = groupDriveService.uploadFile(user, file, cat);
            return ResponseEntity.ok(GroupDriveFileDto.fromEntity(driveFile, user));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during file upload: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Błąd serwera podczas zapisywania pliku.");
        }
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<org.springframework.core.io.Resource> downloadFile(@PathVariable Long id,
            Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        GroupDriveFile driveFile = groupDriveService.getFileForDownload(id, user);

        org.springframework.core.io.Resource resource = new org.springframework.core.io.ByteArrayResource(
                driveFile.getFileData());
        String contentType = driveFile.getMimeType();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + (driveFile.getFileName() != null ? driveFile.getFileName() : "file")
                                + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(resource);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteFile(@PathVariable Long id, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        groupDriveService.deleteFile(id, user);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Plik został pomyślnely usunięty.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/categories")
    public ResponseEntity<Map<String, String>> getCategories() {
        Map<String, String> categories = Arrays.stream(FileCategory.values())
                .collect(Collectors.toMap(
                        FileCategory::name,
                        FileCategory::getDisplayName));
        return ResponseEntity.ok(categories);
    }

    @GetMapping("/quota")
    public ResponseEntity<Map<String, Object>> getQuotaInfo(Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        groupDriveService.recalculateQuota(user, user.getStudentGroup());

        user = userRepository.findById(java.util.Objects.requireNonNull(user.getId())).get();

        Map<String, Object> quotaInfo = new HashMap<>();

        quotaInfo.put("userStorageLimit", user.getStorageLimit());
        quotaInfo.put("userUsedStorage", user.getUsedStorage());

        if (user.getStudentGroup() != null) {
            quotaInfo.put("hasGroup", true);
            quotaInfo.put("groupStorageLimit", user.getStudentGroup().getStorageLimit());
            quotaInfo.put("groupUsedStorage", user.getStudentGroup().getUsedStorage());
            quotaInfo.put("groupName", user.getStudentGroup().getName());
        } else {
            quotaInfo.put("hasGroup", false);
        }

        return ResponseEntity.ok(quotaInfo);
    }
}
