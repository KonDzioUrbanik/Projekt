package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MarketFavoriteRepository extends JpaRepository<MarketFavorite, Long> {
    Optional<MarketFavorite> findByUserAndAd(User user, MarketAd ad);
    boolean existsByUserAndAd(User user, MarketAd ad);
    
    @EntityGraph(attributePaths = {"ad", "ad.author"})
    @Query(value = "SELECT f FROM MarketFavorite f WHERE f.user = :user AND f.ad.status = 'ACTIVE'")
    Page<MarketFavorite> findFavoriteAdsByUser(@Param("user") User user, Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MarketFavorite f WHERE f.ad.id = :adId")
    void deleteAllByAdId(@Param("adId") Long adId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MarketFavorite f WHERE f.user.id = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);

    void deleteByUserAndAd(User user, MarketAd ad);
}
