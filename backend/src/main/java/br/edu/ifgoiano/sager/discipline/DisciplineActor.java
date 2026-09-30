package br.edu.ifgoiano.sager.discipline;

import br.edu.ifgoiano.sager.auth.LocalAccount;
import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import br.edu.ifgoiano.sager.auth.LocalAccountRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
public class DisciplineActor {
    private final LocalAccountRepository accounts;
    public DisciplineActor(LocalAccountRepository accounts) { this.accounts = accounts; }
    public LocalAccount current() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof LocalAccountPrincipal principal))
            throw new DisciplineApiException(HttpStatus.UNAUTHORIZED,"unauthorized","Autenticação necessária.");
        return accounts.findById(principal.id()).filter(account -> account.active()
                && account.email().equals(principal.email()) && account.profile().equals(principal.profile())
                && java.util.Objects.equals(account.residentId(), principal.residentId())
                && java.util.Objects.equals(account.supervisorId(), principal.supervisorId()))
                .orElseThrow(() -> new DisciplineApiException(HttpStatus.UNAUTHORIZED,"unauthorized","Sessão revogada."));
    }
    public LocalAccount supervisor() {
        LocalAccount account = current();
        if (!account.profile().equals("supervisor")) throw new DisciplineApiException(HttpStatus.FORBIDDEN,"forbidden","Ação exclusiva do supervisor.");
        return account;
    }
    public LocalAccount resident() {
        LocalAccount account = current();
        if (!account.profile().equals("residente") || account.residentId() == null)
            throw new DisciplineApiException(HttpStatus.FORBIDDEN,"resident_link_required","Conta de residente vinculada necessária.");
        return account;
    }
}
