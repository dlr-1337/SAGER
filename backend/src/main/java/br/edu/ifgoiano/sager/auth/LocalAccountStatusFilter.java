package br.edu.ifgoiano.sager.auth;

import java.io.IOException;
import java.util.Objects;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile({ "local", "production" })
public class LocalAccountStatusFilter extends OncePerRequestFilter {
    private final LocalAccountRepository accounts;

    public LocalAccountStatusFilter(LocalAccountRepository accounts) {
        this.accounts = accounts;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LocalAccountPrincipal principal) {
            boolean current = accounts.findById(principal.id())
                    .filter(account -> account.active() && Objects.equals(account.enrollment(), principal.enrollment())
                            && account.profile().equals(principal.profile())
                            && Objects.equals(account.residentId(), principal.residentId())
                            && Objects.equals(account.supervisorId(), principal.supervisorId()))
                    .isPresent();
            if (!current) {
                SecurityContextHolder.clearContext();
                if (request.getSession(false) != null) {
                    request.getSession(false).invalidate();
                }
                response.sendError(HttpStatus.UNAUTHORIZED.value());
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
