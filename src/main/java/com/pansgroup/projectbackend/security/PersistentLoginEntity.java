package com.pansgroup.projectbackend.security;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

/**
 * Encja pomocnicza służąca do tego, aby Hibernate automatycznie utworzył tabelę
 * 'persistent_logins' wymaganą przez mechanizm Persistent Token Remember Me
 * w Spring Security (JdbcTokenRepositoryImpl).
 */
@Entity
@Table(name = "persistent_logins")
@Getter
@Setter
@NoArgsConstructor
public class PersistentLoginEntity {

    @Id
    @Column(name = "series", length = 64, nullable = false)
    private String series;

    @Column(name = "username", length = 64, nullable = false)
    private String username;

    @Column(name = "token", length = 64, nullable = false)
    private String token;

    @Column(name = "last_used", nullable = false)
    private Date lastUsed;
}
