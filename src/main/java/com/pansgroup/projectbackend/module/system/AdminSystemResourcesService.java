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
    public void refreshCachedStats() {
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
            // 1. Database Size
            Long dbRes = jdbcTemplate.queryForObject("SELECT pg_database_size(current_database())", Long.class);
            long dbSize = dbRes != null ? dbRes : 0L;
            stats.setTotalDbSize(dbSize);

            // 2. Avatars Count & Size
            long avatarCount = userRepository.count();
            stats.setAvatarCount(avatarCount);
            
            long avatarSize = 0L;
            try {
                // Method 1: OCTET_LENGTH (bytea)
                Long res = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(OCTET_LENGTH(avatar_data)), 0) FROM users WHERE avatar_data IS NOT NULL", Long.class);
                avatarSize = res != null ? res : 0L;
                
                // Method 2: OID Fallback
                if (avatarSize == 0 && avatarCount > 0) {
                    try {
                        Long oidRes = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(lo_size(avatar_data::oid)), 0) FROM users WHERE avatar_data IS NOT NULL", Long.class);
                        avatarSize = oidRes != null ? oidRes : 0L;
                    } catch (Exception e_oid) {
                        // Method 3: pg_column_size Fallback
                        Long colRes = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(pg_column_size(avatar_data)), 0) FROM users WHERE avatar_data IS NOT NULL", Long.class);
                        avatarSize = colRes != null ? colRes : 0L;
                    }
                }
            } catch (Exception e_av) {
                // Method 4: CamelCase Fallback
                try {
                    Long camelRes = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(pg_column_size(\"avatarData\")), 0) FROM users WHERE \"avatarData\" IS NOT NULL", Long.class);
                    avatarSize = camelRes != null ? camelRes : 0L;
                } catch (Exception e_av2) { avatarSize = 0L; }
            }
            stats.setTotalAvatarSize(avatarSize);

            // 3. Attachments Count & Size (Announcements + Feedback)
            long annAttachCount = attachmentRepository.count();
            long feedbackAttachCount = 0L;
            try {
                Long fCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM feedback WHERE attachment_data IS NOT NULL", Long.class);
                feedbackAttachCount = fCount != null ? fCount : 0L;
            } catch (Exception e) { feedbackAttachCount = 0L; }
            
            stats.setAttachmentCount(annAttachCount + feedbackAttachCount);
            stats.setTotalFileCount(avatarCount + annAttachCount + feedbackAttachCount);

            long annSize = 0L;
            try {
                Long annRes = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(file_size), 0) FROM announcement_attachments", Long.class);
                annSize = annRes != null ? annRes : 0L;
                if (annSize == 0 && annAttachCount > 0) {
                    Long physRes = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(OCTET_LENGTH(file_data)), 0) FROM announcement_attachments", Long.class);
                    annSize = physRes != null ? physRes : 0L;
                }
            } catch (Exception e) { 
                try {
                    Long camelAnn = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(\"fileSize\"), 0) FROM announcement_attachments", Long.class);
                    annSize = camelAnn != null ? camelAnn : 0L;
                } catch (Exception e2) { annSize = 0L; }
            }

            long feedbackSize = 0L;
            try {
                Long fbRes = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(OCTET_LENGTH(attachment_data)), 0) FROM feedback", Long.class);
                feedbackSize = fbRes != null ? fbRes : 0L;
            } catch (Exception e) { feedbackSize = 0L; }

            stats.setTotalAttachmentSize(annSize + feedbackSize);
            stats.setTotalLogSize(0L);
            
            log.info("Zasoby końcowe: DB={} MB, Awatary={}, Załączniki={}, Pliki={}", 
                dbSize/1024/1024, avatarSize, stats.getTotalAttachmentSize(), stats.getTotalFileCount());
                
            return stats;
        } catch (Exception e) {
            log.error("Błąd przeliczania zasobów: {}", e.getMessage());
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

    public Map<String, Object> getStorageBreakdown() {
        SystemResourceStats s = getCurrentStats();
        Map<String, Object> breakdown = new HashMap<>();
        if (s == null) return breakdown;
        
        breakdown.put("total", s.getTotalDbSize());
        breakdown.put("avatars", s.getTotalAvatarSize());
        breakdown.put("attachments", s.getTotalAttachmentSize());
        breakdown.put("avatarCount", s.getAvatarCount());
        breakdown.put("attachmentCount", s.getAttachmentCount());
        breakdown.put("logs", s.getTotalLogSize());
        
        long total = s.getTotalDbSize() != null ? s.getTotalDbSize() : 0L;
        long avatars = s.getTotalAvatarSize() != null ? s.getTotalAvatarSize() : 0L;
        long items = s.getTotalAttachmentSize() != null ? s.getTotalAttachmentSize() : 0L;
        
        breakdown.put("other", total - avatars - items);
        return breakdown;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTopUsersByStorage() {
        String sql = 
            "SELECT u.id, u.email, " +
            " COALESCE(u.first_name, '') as firstName, " +
            " COALESCE(u.last_name, '') as lastName, " +
            " COALESCE(OCTET_LENGTH(u.avatar_data), 0) as avatarSize, " +
            " (COALESCE((SELECT SUM(OCTET_LENGTH(f.attachment_data)) FROM feedback f WHERE f.email = u.email), 0) + " +
            "  COALESCE((SELECT SUM(COALESCE(a.file_size, OCTET_LENGTH(a.file_data))) FROM announcement_attachments a " +
            "            JOIN group_announcements an ON a.announcement_id = an.id " +
            "            WHERE an.author_id = u.id), 0) " +
            " ) as attachmentSize, " +
            " (COALESCE(OCTET_LENGTH(u.avatar_data), 0) + " +
            "  COALESCE((SELECT SUM(OCTET_LENGTH(f.attachment_data)) FROM feedback f WHERE f.email = u.email), 0) + " +
            "  COALESCE((SELECT SUM(COALESCE(a.file_size, OCTET_LENGTH(a.file_data))) FROM announcement_attachments a " +
            "            JOIN group_announcements an ON a.announcement_id = an.id " +
            "            WHERE an.author_id = u.id), 0) " +
            " ) as totalSize " +
            "FROM users u " +
            "WHERE u.id IN (SELECT DISTINCT id FROM users WHERE avatar_data IS NOT NULL) OR " +
            "      u.email IN (SELECT DISTINCT email FROM feedback WHERE attachment_data IS NOT NULL) OR " +
            "      u.id IN (SELECT DISTINCT author_id FROM group_announcements an JOIN announcement_attachments a ON a.announcement_id = an.id) " +
            "ORDER BY totalSize DESC LIMIT 10";
        try {
            return jdbcTemplate.queryForList(sql);
        } catch (Exception e) {
            log.error("Błąd zapytania TOP użytkowników: {}", e.getMessage());
            return jdbcTemplate.queryForList("SELECT id, email, 0 as avatarSize, 0 as attachmentSize, 0 as totalSize FROM users ORDER BY id LIMIT 10");
        }
    }
}
