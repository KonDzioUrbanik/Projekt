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

    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.firstName) LIKE :pattern OR " +
           "LOWER(u.lastName) LIKE :pattern OR " +
           "LOWER(u.email) LIKE :pattern " +
           "ORDER BY u.lastName, u.firstName")
    List<User> searchByNameOrEmail(@Param("pattern") String pattern);
}
