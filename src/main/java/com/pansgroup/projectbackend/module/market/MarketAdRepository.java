package com.pansgroup.projectbackend.module.market;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MarketAdRepository extends JpaRepository<MarketAd, Long> {
    @EntityGraph(attributePaths = "author")
    Page<MarketAd> findAllByStatusOrderByCreatedAtDesc(AdStatus status, Pageable pageable);
    
    @EntityGraph(attributePaths = "author")
    @Query(value = "SELECT m FROM MarketAd m WHERE m.status = :status " +
           "AND (:category IS NULL OR m.category = :category) " +
           "AND (:condition IS NULL OR m.condition = :condition) " +
           "AND (:search IS NULL OR LOWER(m.title) LIKE :search OR LOWER(m.description) LIKE :search)",
           countQuery = "SELECT COUNT(m) FROM MarketAd m WHERE m.status = :status " +
           "AND (:category IS NULL OR m.category = :category) " +
           "AND (:condition IS NULL OR m.condition = :condition) " +
           "AND (:search IS NULL OR LOWER(m.title) LIKE :search OR LOWER(m.description) LIKE :search)")
    Page<MarketAd> findFilteredAds(@Param("status") AdStatus status,
                                   @Param("category") AdCategory category,
                                   @Param("condition") AdCondition condition,
                                   @Param("search") String search,
                                   Pageable pageable);

    @EntityGraph(attributePaths = "author")
    @Query(value = "SELECT m FROM MarketAd m WHERE m.author.id = :authorId " +
           "AND (:category IS NULL OR m.category = :category) " +
           "AND (:condition IS NULL OR m.condition = :condition) " +
           "AND (:search IS NULL OR LOWER(m.title) LIKE :search OR LOWER(m.description) LIKE :search)",
           countQuery = "SELECT COUNT(m) FROM MarketAd m WHERE m.author.id = :authorId " +
           "AND (:category IS NULL OR m.category = :category) " +
           "AND (:condition IS NULL OR m.condition = :condition) " +
           "AND (:search IS NULL OR LOWER(m.title) LIKE :search OR LOWER(m.description) LIKE :search)")
    Page<MarketAd> findMyFilteredAds(@Param("authorId") Long authorId,
                                     @Param("category") AdCategory category,
                                     @Param("condition") AdCondition condition,
                                     @Param("search") String search,
                                     Pageable pageable);

    @EntityGraph(attributePaths = "author")
    Page<MarketAd> findAllByAuthorIdOrderByCreatedAtDesc(Long authorId, Pageable pageable);
    
    List<MarketAd> findByAuthorId(Long authorId);

    List<MarketAd> findByStatusAndExpiresAtBefore(AdStatus status, LocalDateTime date);
    
    long countByAuthorIdAndStatus(Long authorId, AdStatus status);
    long countByAuthorIdAndCreatedAtAfter(Long authorId, LocalDateTime date);
    
    long countByStatus(AdStatus status);
    
    @Query("SELECT COUNT(m) FROM MarketAd m WHERE m.createdAt >= :date")
    long countAllByCreatedAtAfter(@Param("date") LocalDateTime date);
    
    @Query("SELECT COUNT(DISTINCT m.category) FROM MarketAd m WHERE m.status = :status")
    long countDistinctCategoriesByStatus(@Param("status") AdStatus status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MarketAd m WHERE m.author.id = :userId")
    void deleteAllByAuthorId(@Param("userId") Long userId);
}
