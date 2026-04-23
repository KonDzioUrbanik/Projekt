package com.pansgroup.projectbackend.security;

/**
 * Centralized security role constants to prevent hardcoded strings across modules.
 */
public final class SecurityRoles {
    
    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_STAROSTA = "STAROSTA";
    public static final String ROLE_STUDENT = "STUDENT";

    private SecurityRoles() {
        // Private constructor to prevent instantiation
    }
}
