package com.pansgroup.projectbackend.module.system;

import com.pansgroup.projectbackend.module.announcement.AnnouncementAttachmentRepository;
import com.pansgroup.projectbackend.module.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminSystemResourcesService {

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final AnnouncementAttachmentRepository attachmentRepository;
    private final SystemResourceStatsRepository statsRepository;

    private SystemResourceStats cachedStats;

    @Transactional(readOnly = true)
    public SystemResourceStats getCurrentStats() {
        if (cachedStats == null) {
            refreshCachedStats();
        }
        return cachedStats;
    }

    @Scheduled(fixedRate = 600000) // 10 minutes
    public synchronized void refreshCachedStats() {
        this.cachedStats = calculateStats();
    }

    @Scheduled(cron = "0 0 2 * * *") // Daily at 02:00
    public void createDailySnapshot() {
        log.info("Tworzenie dziennego snapshotu zasobów...");
        SystemResourceStats stats = calculateStats();
        statsRepository.save(stats);
    }

    private SystemResourceStats calculateStats() {
        SystemResourceStats stats = new SystemResourceStats();
        try {
            // 1. PHYSICAL: Database Size (infrastructure)
            Long dbRes = jdbcTemplate.queryForObject("SELECT pg_database_size(current_database())", Long.class);
            stats.setTotalDbSize(dbRes != null ? dbRes : 0L);

            // 2. LOGICAL: Avatars (now pure bytea)
            long avatarCount = userRepository.count();
            Long avatarSizeRes = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(OCTET_LENGTH(avatar_data)), 0) FROM users", Long.class);
            stats.setAvatarLogicalSize(avatarSizeRes != null ? avatarSizeRes : 0L);
            stats.setAvatarCount(avatarCount);

            // 3. LOGICAL: Attachments (Announcements - meta + filesystem)
            long annCount = attachmentRepository.count();
            Long annSizeRes = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(file_size), 0) FROM announcement_attachments", Long.class);
            long annSize = annSizeRes != null ? annSizeRes : 0L;

            // 4. LOGICAL: Feedback (now pure bytea)
            Long fbCountRes = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM feedback WHERE attachment_data IS NOT NULL", Long.class);
            long fbCount = fbCountRes != null ? fbCountRes : 0L;
            Long fbSizeRes = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(OCTET_LENGTH(attachment_data)), 0) FROM feedback", Long.class);
            long fbSize = fbSizeRes != null ? fbSizeRes : 0L;

            stats.setAttachmentLogicalSize(annSize + fbSize);
            stats.setAttachmentCount(annCount + fbCount);

            // 5. Totals
            stats.setTotalLogicalSize(stats.getAvatarLogicalSize() + stats.getAttachmentLogicalSize());
            stats.setTotalFileCount(avatarCount + annCount + fbCount);
            stats.setTotalLogSize(0L);

            return stats;
        } catch (Exception e) {
            log.error("Failed to calculate storage stats (bytea mode): {}", e.getMessage());
            return cachedStats != null ? cachedStats : new SystemResourceStats();
        }
    }

    public void refreshStats() {
        refreshCachedStats();
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupOldStats() {
        log.info("Czyszczenie starych statystyk zasobów (starsze niż 90 dni)...");
        statsRepository.deleteOlderThan(java.time.LocalDateTime.now().minusDays(90));
    }

    public List<SystemResourceStats> getHistory() {
        return statsRepository.findTop14ByOrderByTimestampDesc();
    }

    /**
     * Debugging method to validate correctness of storage reporting
     */

    public Map<String, Object> getStorageBreakdown() {
        SystemResourceStats s = getCurrentStats();
        Map<String, Object> breakdown = new HashMap<>();
        if (s == null) return breakdown;
        
        breakdown.put("totalPhysical", s.getTotalDbSize());
        breakdown.put("totalLogical", s.getTotalLogicalSize());
        breakdown.put("avatars", s.getAvatarLogicalSize());
        breakdown.put("attachments", s.getAttachmentLogicalSize());
        breakdown.put("avatarCount", s.getAvatarCount());
        breakdown.put("attachmentCount", s.getAttachmentCount());
        
        long totalPhys = s.getTotalDbSize() != null ? s.getTotalDbSize() : 0L;
        long totalLogi = s.getTotalLogicalSize() != null ? s.getTotalLogicalSize() : 0L;
        breakdown.put("overhead", totalPhys - totalLogi);
        return breakdown;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getStorageDebugInfo() {
        String sql = 
            "SELECT 'User Avatar' as source, id::text as ref_id, email as owner, " +
            "OCTET_LENGTH(avatar_data) as size_bytes, 'bytea' as type " +
            "FROM users WHERE avatar_data IS NOT NULL " +
            "UNION ALL " +
            "SELECT 'Feedback' as source, id::text, email, " +
            "OCTET_LENGTH(attachment_data), 'bytea' " +
            "FROM feedback WHERE attachment_data IS NOT NULL " +
            "UNION ALL " +
            "SELECT 'Announcement' as source, announcement_id::text, 'FILE: ' || file_path, " +
            "file_size, 'filesystem' " +
            "FROM announcement_attachments";
        
        try {
            return jdbcTemplate.queryForList(sql);
        } catch (Exception e) {
            log.error("Storage debug info failed: {}", e.getMessage());
            return List.of();
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTopUsersByStorage() {
        String sql = 
            "WITH user_storage AS (" +
            "    -- Avatars\n" +
            "    SELECT id as user_id, OCTET_LENGTH(avatar_data) as size, 'AVATAR' as type FROM users WHERE avatar_data IS NOT NULL\n" +
            "    UNION ALL\n" +
            "    -- Feedback (directly linked by userId)\n" +
            "    SELECT user_id, OCTET_LENGTH(attachment_data), 'ATTACHMENT' FROM feedback WHERE attachment_data IS NOT NULL AND user_id IS NOT NULL\n" +
            "    UNION ALL\n" +
            "    -- Feedback (fallback by email linkage for guests)\n" +
            "    SELECT u_fb.id, OCTET_LENGTH(f_fb.attachment_data), 'ATTACHMENT' \n" +
            "    FROM feedback f_fb \n" +
            "    JOIN users u_fb ON LOWER(f_fb.email) = LOWER(u_fb.email) \n" +
            "    WHERE f_fb.attachment_data IS NOT NULL AND f_fb.user_id IS NULL\n" +
            "    UNION ALL\n" +
            "    -- Announcements\n" +
            "    SELECT ga.author_id, aa.file_size, 'ATTACHMENT' \n" +
            "    FROM announcement_attachments aa \n" +
            "    JOIN group_announcements ga ON aa.announcement_id = ga.id\n" +
            ")\n" +
            "SELECT \n" +
            "    u.id, u.email, u.first_name as \"firstName\", u.last_name as \"lastName\",\n" +
            "    COALESCE((SELECT SUM(us1.size) FROM user_storage us1 WHERE us1.user_id = u.id AND us1.type = 'AVATAR'), 0) as \"avatarSize\",\n" +
            "    COALESCE((SELECT SUM(us2.size) FROM user_storage us2 WHERE us2.user_id = u.id AND us2.type = 'ATTACHMENT'), 0) as \"attachmentSize\",\n" +
            "    COALESCE((SELECT SUM(us3.size) FROM user_storage us3 WHERE us3.user_id = u.id), 0) as \"totalSize\"\n" +
            "FROM users u\n" +
            "WHERE EXISTS (SELECT 1 FROM user_storage us_check WHERE us_check.user_id = u.id)\n" +
            "ORDER BY \"totalSize\" DESC LIMIT 10";

        try {
            return jdbcTemplate.queryForList(sql);
        } catch (Exception e) {
            log.error("Top users ranking failed (detailed): ", e);
            return List.of();
        }
    }
}
