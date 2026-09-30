package br.edu.ifgoiano.sager.operations;

import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
public class OpsActor {
    public LocalAccountPrincipal current() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof LocalAccountPrincipal principal)
                || principal.id() == null) {
            throw new OpsApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Autenticação necessária.");
        }
        return principal;
    }

    public LocalAccountPrincipal supervisor() {
        LocalAccountPrincipal principal = current();
        if (!"supervisor".equals(principal.profile())) {
            throw new OpsApiException(HttpStatus.FORBIDDEN, "forbidden", "Ação exclusiva do supervisor.");
        }
        return principal;
    }

    public LocalAccountPrincipal resident() {
        LocalAccountPrincipal principal = current();
        if (!"residente".equals(principal.profile())) {
            throw new OpsApiException(HttpStatus.FORBIDDEN, "forbidden", "Ação exclusiva do residente.");
        }
        if (principal.residentId() == null) {
            throw new OpsApiException(HttpStatus.FORBIDDEN, "resident_link_required",
                    "Vincule a conta ao cadastro do residente antes de solicitar saídas.");
        }
        return principal;
    }
}
