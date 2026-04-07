package com.pansgroup.projectbackend.module.system;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class AdminRateLimiterFilter implements Filter {

    private final Map<String, RateLimitState> limits = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_MINUTE = 100;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) 
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        if (path.startsWith("/api/admin/system") || path.startsWith("/api/admin/resources") || path.startsWith("/api/admin/security")) {
            String adminUser = httpRequest.getUserPrincipal() != null ? httpRequest.getUserPrincipal().getName() : "anonymous";
            
            if (!isAllowed(adminUser)) {
                HttpServletResponse httpResponse = (HttpServletResponse) response;
                httpResponse.setStatus(429);
                httpResponse.getWriter().write("Too many monitoring requests. Please wait a minute.");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private boolean isAllowed(String user) {
        long currentMinute = System.currentTimeMillis() / 60000;
        RateLimitState state = limits.computeIfAbsent(user, k -> new RateLimitState(currentMinute));

        if (state.minute != currentMinute) {
            state.minute = currentMinute;
            state.count.set(1);
            return true;
        }

        return state.count.incrementAndGet() <= MAX_REQUESTS_PER_MINUTE;
    }

    private static class RateLimitState {
        volatile long minute;
        final AtomicLong count = new AtomicLong(0);

        RateLimitState(long minute) {
            this.minute = minute;
        }
    }
}
