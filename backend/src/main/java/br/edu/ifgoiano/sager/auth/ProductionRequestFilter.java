package br.edu.ifgoiano.sager.auth;

import java.io.IOException;
import br.edu.ifgoiano.sager.api.ApiErrors;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile("production")
public class ProductionRequestFilter extends OncePerRequestFilter {
    private final String host;
    private final ApiErrors errors;
    public ProductionRequestFilter(@Value("${sager.production.public-host}") String host, ApiErrors errors) {
        this.host = host;
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        // Only Docker-private health probes may use cleartext on the unexposed backend port.
        boolean health = request.getMethod().equals("GET") && (request.getServletPath().equals("/actuator/health")
                || request.getServletPath().startsWith("/actuator/health/"));
        if (!health && (!request.isSecure() || !host.equalsIgnoreCase(request.getServerName()) || request.getServerPort() != 443)) {
            errors.write(request, response, 403, "invalid_origin", "Acesse o sistema pelo endereço HTTPS institucional.");
            return;
        }
        chain.doFilter(request, response);
    }
}
