package com.pansgroup.projectbackend.module.user.confirmation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ConfirmationTokenRepository extends JpaRepository<ConfirmationToken,Long> {
    Optional<ConfirmationToken> findByToken(String token);

    // Baza usunie to fizycznie, ignorując kaprysy Hibernate'a (Native SQL)
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "DELETE FROM confirmation_token WHERE user_id = :userId", nativeQuery = true)
    void forceDeleteByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);

    // Spring Data sam wygeneruje bezpiecznego DELETE'a po Userze
    void deleteByUser(com.pansgroup.projectbackend.module.user.User user);
}
