package com.pansgroup.projectbackend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

public class JwtAuthFilter extends OncePerRequestFilter {
    private final Key key;

    public JwtAuthFilter(String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String auth = req.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            chain.doFilter(req, res);
            return;
        }

        String token = auth.substring(7).trim();
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            String email = claims.getSubject();
            Collection<? extends GrantedAuthority> authorities = extractAuthorities(claims);

            if (email != null) {
                var authToken = new UsernamePasswordAuthenticationToken(email, null, authorities);
                // LOG diagnostyczny
                System.out.println("JWT subject=" + email + ", authorities=" + authorities);
                SecurityContextHolder.getContext().setAuthentication(authToken);
            } else {
                SecurityContextHolder.clearContext();
            }
        } catch (Exception e) {
            SecurityContextHolder.clearContext();
        }

        chain.doFilter(req, res);
    }

    private Collection<? extends GrantedAuthority> extractAuthorities(Claims claims) {
        Object roleClaim = claims.get("role");
        List<SimpleGrantedAuthority> result = new ArrayList<>();

        if (roleClaim instanceof String s) {
            addRole(result, s);
        } else if (roleClaim instanceof List<?> list) {
            for (Object o : list) {
                if (o != null) addRole(result, String.valueOf(o));
            }
        }
        return result;
    }

    private void addRole(List<SimpleGrantedAuthority> target, String rawRole) {
        String r = Objects.toString(rawRole, "").trim();
        if (r.isEmpty()) return;
        String authority = r.startsWith("ROLE_") ? r : "ROLE_" + r;
        target.add(new SimpleGrantedAuthority(authority));
    }
}