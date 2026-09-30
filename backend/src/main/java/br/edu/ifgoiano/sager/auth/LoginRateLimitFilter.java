package br.edu.ifgoiano.sager.auth;

import java.io.IOException;
import br.edu.ifgoiano.sager.api.ApiErrors;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile("production")
public class LoginRateLimitFilter extends OncePerRequestFilter {
    private final LoginRateLimiter limiter;
    private final ApiErrors errors;
    public LoginRateLimitFilter(LoginRateLimiter limiter, ApiErrors errors) { this.limiter = limiter; this.errors = errors; }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getMethod().equals("POST") || !request.getServletPath().equals("/api/v1/auth/login");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!limiter.allow(request.getParameter("email"), request.getRemoteAddr())) {
            response.setHeader("Retry-After", "900");
            errors.write(request, response, 429, "rate_limited", "Muitas tentativas. Aguarde e tente novamente.");
            return;
        }
        chain.doFilter(request, response);
    }
}
