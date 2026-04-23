package com.pansgroup.projectbackend.module.survey;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SurveyRepository extends JpaRepository<Survey, Long> {

    @Query("""
            select distinct s from Survey s
            left join fetch s.author
            left join fetch s.targetGroup
            left join fetch s.options o
            where (:isAdmin = true or s.globalScope = true or s.targetGroup.id = :groupId)
            order by s.createdAt desc
            """)
    List<Survey> findVisibleForUser(@Param("isAdmin") boolean isAdmin, @Param("groupId") Long groupId);

    @Query("""
            select distinct s from Survey s
            left join fetch s.author
            left join fetch s.targetGroup
            left join fetch s.options o
            where s.id = :id
            """)
    Optional<Survey> findDetailedById(@Param("id") Long id);
}

