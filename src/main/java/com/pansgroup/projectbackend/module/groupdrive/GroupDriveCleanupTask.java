package com.pansgroup.projectbackend.module.groupdrive;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Component
@lombok.extern.slf4j.Slf4j
public class GroupDriveCleanupTask {

    private final GroupDriveFileRepository groupDriveFileRepository;

    public GroupDriveCleanupTask(GroupDriveFileRepository groupDriveFileRepository) {
        this.groupDriveFileRepository = groupDriveFileRepository;
    }

    /**
     * Uruchamia się raz w tygodniu w niedzielę o 03:00.
     * Usuwa trwale rekordy plików, które mialy ustawione isDeleted=true starsze niż
     * 30 dni.
     */
    @Scheduled(cron = "0 0 3 * * SUN")
    @Transactional
    public void cleanupDeletedFiles() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        List<GroupDriveFile> expiredFiles = groupDriveFileRepository.findByIsDeletedTrueAndDeletedAtBefore(cutoff);

        if (!expiredFiles.isEmpty()) {
            log.info("Cron: Usuwam {} usuniętych plików starszych niż 30 dni.", expiredFiles.size());
            groupDriveFileRepository.deleteAll(expiredFiles);
        }
    }
}
