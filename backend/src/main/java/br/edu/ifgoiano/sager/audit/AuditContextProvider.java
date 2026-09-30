package br.edu.ifgoiano.sager.audit;

import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
@Profile("local")
public class AuditContextProvider {
    public static final String REQUEST_ID_ATTRIBUTE =
            "br.edu.ifgoiano.sager.audit.RequestCorrelationFilter.requestId";
    private static final Set<String> PROFILES = Set.of("gestor", "supervisor", "residente");

    public Context requireContext() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof LocalAccountPrincipal principal)
                || principal.id() == null || principal.profile() == null
                || !PROFILES.contains(principal.profile())
                || !(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)
                || !(attributes.getRequest().getAttribute(REQUEST_ID_ATTRIBUTE) instanceof UUID requestId)) {
            throw new IllegalStateException("Auditoria exige uma requisição local autenticada.");
        }
        return new Context(principal.id(), principal.profile(), requestId);
    }

    public record Context(UUID actorId, String actorProfile, UUID requestId) {
    }
}
