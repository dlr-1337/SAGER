package br.edu.ifgoiano.sager.auth;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile({ "local", "production" })
public class LocalAccountStatusFilter extends OncePerRequestFilter {
    /** Automatic page refreshes send this header and never count as the person's action. */
    public static final String AUTO_REFRESH_HEADER = "X-Sager-Auto-Refresh";
    static final String LAST_ACTION = "sager.lastActionAt";
    private final LocalAccountRepository accounts;
    private final Duration idleTimeout;
    // Real time, like Spring Session's own expiry: integration tests move the application Clock by
    // days inside one session. AuthFlowIntegrationTest replaces it to control the idle time.
    Clock clock = Clock.systemUTC();

    public LocalAccountStatusFilter(LocalAccountRepository accounts,
            @Value("${spring.session.timeout:30m}") Duration idleTimeout) {
        this.accounts = accounts;
        this.idleTimeout = idleTimeout;
    }

    /** Records a person's action in the session, as on login. */
    public void recordAction(HttpServletRequest request) {
        request.getSession().setAttribute(LAST_ACTION, clock.instant());
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
            if (!current || idle(request)) {
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

    /** Ends the session 30 minutes after the person's last action, even while pages refresh themselves. */
    private boolean idle(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return false;
        Instant now = clock.instant();
        if (session.getAttribute(LAST_ACTION) instanceof Instant last) {
            if (now.isAfter(last.plus(idleTimeout))) return true;
            if ("1".equals(request.getHeader(AUTO_REFRESH_HEADER))) return false;
        }
        // A session opened before this rule has no last action yet; it starts counting now.
        session.setAttribute(LAST_ACTION, now);
        return false;
    }
}
