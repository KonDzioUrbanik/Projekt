package com.pansgroup.projectbackend.module.announcement;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AnnouncementReadConfirmationRepository extends JpaRepository<AnnouncementReadConfirmation, Long> {

    boolean existsByAnnouncement_IdAndReader_Id(Long announcementId, Long readerId);

    @Query("""
            select c.announcement.id, count(c)
            from AnnouncementReadConfirmation c
            where c.announcement.id in :announcementIds
            group by c.announcement.id
            """)
    List<Object[]> countByAnnouncementIds(Collection<Long> announcementIds);

    @Query("""
            select c.announcement.id
            from AnnouncementReadConfirmation c
            where c.reader.id = :readerId and c.announcement.id in :announcementIds
            """)
    List<Long> findReadAnnouncementIdsByReaderAndAnnouncementIds(Long readerId, Collection<Long> announcementIds);
}
