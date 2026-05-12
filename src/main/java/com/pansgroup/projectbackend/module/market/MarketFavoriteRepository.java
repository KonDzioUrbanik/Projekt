package com.pansgroup.projectbackend.module.market;

import com.pansgroup.projectbackend.module.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MarketFavoriteRepository extends JpaRepository<MarketFavorite, Long> {
    Optional<MarketFavorite> findByUserAndAd(User user, MarketAd ad);
    boolean existsByUserAndAd(User user, MarketAd ad);
    
    @Query(value = "SELECT f.ad FROM MarketFavorite f JOIN FETCH f.ad.author WHERE f.user = :user AND f.ad.status = 'ACTIVE'",
           countQuery = "SELECT COUNT(f) FROM MarketFavorite f WHERE f.user = :user AND f.ad.status = 'ACTIVE'")
    Page<MarketAd> findFavoriteAdsByUser(@Param("user") User user, Pageable pageable);

    void deleteByUserAndAd(User user, MarketAd ad);
}
