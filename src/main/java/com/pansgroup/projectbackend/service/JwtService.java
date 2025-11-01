package com.pansgroup.projectbackend.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.WeakKeyException;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.Map;

@Getter
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration:3600000}") long expirationMs // domyślnie 1h
    ) {
        String s = secret == null ? "" : secret.trim();
        byte[] keyBytes = (s.contains("-") || s.contains("_"))
                ? Decoders.BASE64URL.decode(s)   // klucze URL-safe (z '-' lub '_')
                : Decoders.BASE64.decode(s);     // zwykłe Base64

        if (keyBytes.length < 32) { // < 256 bitów
            throw new WeakKeyException("JWT secret must be at least 256 bits after decoding (got "
                    + (keyBytes.length * 8) + " bits).");
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    public String generate(String subject, Map<String, Object> extraClaims) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(subject)
                .addClaims(extraClaims == null ? Map.of() : extraClaims)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + expirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, String expectedSubject) {
        try {
            Claims claims = extractAllClaims(token);
            boolean notExpired = claims.getExpiration() != null && claims.getExpiration().after(new Date());
            boolean subjectOk = expectedSubject == null || expectedSubject.equals(claims.getSubject());
            return notExpired && subjectOk;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String extractSubject(String token) {
        return extractAllClaims(token).getSubject();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
