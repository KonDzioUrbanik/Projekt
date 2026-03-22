package com.pansgroup.projectbackend.security;

import com.pansgroup.projectbackend.module.user.User;
import com.pansgroup.projectbackend.module.user.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import org.springframework.lang.NonNull;
import java.io.IOException;

/**
 * Filtr sprawdzający status konta (czy zablokowane/nieaktywne) przy każdym żądaniu.
 * Rozwiązuje problem bypassu blokady w trakcie aktywnej sesji użytkownika.
 */
@Component
public class AccountStatusFilter extends OncePerRequestFilter {

    private final UserService userService;

    public AccountStatusFilter(UserService userService) {
        this.userService = userService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, 
                                    @NonNull HttpServletResponse response, 
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // Sprawdzamy tylko zalogowanych użytkowników (nie anonimowych)
        if (auth != null && auth.isAuthenticated() && !isAnonymous(auth)) {
            String email = getEmailFromAuthentication(auth);

            if (email != null) {
                try {
                    User user = userService.findUserByEmailInternal(email);
                    
                    if (user.isBlocked() || !user.isActivated()) {
                        // Natychmiastowe wylogowanie
                        SecurityContextHolder.clearContext();
                        request.getSession().invalidate();
                        
                        String reason = user.isBlocked() ? "blocked" : "inactive";
                        response.sendRedirect(request.getContextPath() + "/login?error=" + reason);
                        return;
                    }
                } catch (Exception e) {
                    // W przypadku błędu (np. usunięcia użytkownika w trakcie sesji) bezpieczniej jest wylogować
                    SecurityContextHolder.clearContext();
                    request.getSession().invalidate();
                    response.sendRedirect(request.getContextPath() + "/login?error=error");
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isAnonymous(Authentication auth) {
        return auth.getPrincipal() instanceof String && "anonymousUser".equals(auth.getPrincipal());
    }

    private String getEmailFromAuthentication(Authentication auth) {
        if (auth.getPrincipal() instanceof UserDetails) {
            return ((UserDetails) auth.getPrincipal()).getUsername();
        } else if (auth.getPrincipal() instanceof String) {
            return (String) auth.getPrincipal();
        }
        return null;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getServletPath();
        // Pomijamy zasoby statyczne oraz strony publiczne, aby uniknąć pętli przekierowań
        return path.startsWith("/static/") || 
               path.startsWith("/css/") || 
               path.startsWith("/js/") || 
               path.startsWith("/images/") ||
               path.startsWith("/favicon") ||
               path.equals("/login") ||
               path.equals("/logout") ||
               path.equals("/register") ||
               path.equals("/confirm") ||
               path.equals("/reset-password") ||
               path.equals("/forgot-password") ||
               path.equals("/error");
    }
}
