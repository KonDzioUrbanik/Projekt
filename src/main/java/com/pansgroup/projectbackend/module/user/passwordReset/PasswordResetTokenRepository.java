package com.pansgroup.projectbackend.module.user.passwordReset;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken,Long> {
    Optional<PasswordResetToken> findByToken(String token);

    // Baza usunie to fizycznie, ignorując kaprysy Hibernate'a (Native SQL)
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "DELETE FROM password_reset_token WHERE user_id = :userId", nativeQuery = true)
    void forceDeleteByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying
    @jakarta.transaction.Transactional
    void deleteByUser(com.pansgroup.projectbackend.module.user.User user);
}
