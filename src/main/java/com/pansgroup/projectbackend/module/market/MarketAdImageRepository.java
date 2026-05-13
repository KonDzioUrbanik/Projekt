package com.pansgroup.projectbackend.module.market;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MarketAdImageRepository extends JpaRepository<MarketAdImage, Long> {
    List<MarketAdImage> findByAdId(Long adId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MarketAdImage i WHERE i.ad.id = :adId")
    void deleteAllByAdId(@Param("adId") Long adId);

    @Query("SELECT COALESCE(SUM(i.fileSize), 0) FROM MarketAdImage i WHERE i.ad.id = :adId")
    long sumFileSizeByAdId(@Param("adId") Long adId);
}
