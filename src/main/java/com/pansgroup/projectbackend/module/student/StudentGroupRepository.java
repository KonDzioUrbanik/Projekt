package com.pansgroup.projectbackend.module.student;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface StudentGroupRepository extends JpaRepository<StudentGroup, Long> {

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE StudentGroup g SET g.usedStorage = g.usedStorage + :amount WHERE g.id = :id AND g.usedStorage + :amount <= g.storageLimit")
    int incrementUsedStorage(@Param("id") Long id, @Param("amount") Long amount);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE StudentGroup g SET g.usedStorage = CASE WHEN g.usedStorage >= :amount THEN g.usedStorage - :amount ELSE 0 END WHERE g.id = :id")
    int decrementUsedStorage(@Param("id") Long id, @Param("amount") Long amount);
}
