package com.pansgroup.projectbackend.module.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User,Long> {
    boolean existsByEmail(String email);
    Optional<User> findByEmail(String email);
    boolean existsByNrAlbumu(Integer nrAlbumu);
    long countByStudentGroup(com.pansgroup.projectbackend.module.student.StudentGroup studentGroup);
    long countByRoleIgnoreCaseAndIsActivatedTrue(String role);
    List<User> findByStudentGroup_Id(Long studentGroupId);
    List<User> findByRole(String role);

    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.firstName) LIKE :pattern OR " +
           "LOWER(u.lastName) LIKE :pattern OR " +
           "LOWER(u.email) LIKE :pattern " +
           "ORDER BY u.lastName, u.firstName")
    List<User> searchByNameOrEmail(@Param("pattern") String pattern);

    /** Search users for chat — excludes ADMIN and self. */
    @Query("SELECT u FROM User u WHERE " +
           "u.role NOT IN ('ADMIN', 'ROLE_ADMIN') AND " +
           "u.id <> :excludeId AND " +
           "u.isActivated = true AND " +
           "u.isBlocked = false AND " +
           "(LOWER(u.firstName) LIKE :q OR LOWER(u.lastName) LIKE :q OR " +
           "LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE :q) " +
           "ORDER BY u.lastName, u.firstName")
    List<User> searchChatUsers(@Param("q") String q, @Param("excludeId") Long excludeId);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE User u SET u.usedStorage = u.usedStorage + :size WHERE u.id = :userId AND u.usedStorage + :size <= u.storageLimit")
    int incrementUsedStorage(@Param("userId") Long userId, @Param("size") long size);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE User u SET u.usedStorage = CASE WHEN u.usedStorage >= :size THEN u.usedStorage - :size ELSE 0 END WHERE u.id = :userId")
    void decrementUsedStorage(@Param("userId") Long userId, @Param("size") long size);
}
