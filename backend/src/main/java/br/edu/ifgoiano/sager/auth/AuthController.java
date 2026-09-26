package br.edu.ifgoiano.sager.auth;

import java.util.List;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AuthController {
    private final IdentityRepository identities;

    public AuthController(IdentityRepository identities) {
        this.identities = identities;
    }

    @GetMapping("/api/v1/auth/me")
    public ResponseEntity<MeResponse> me(@AuthenticationPrincipal OidcUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        String issuer = user.getIdToken().getClaimAsString("iss");
        LocalIdentity identity = identities.find(issuer, user.getIdToken().getSubject())
                .filter(local -> local.active() && !local.profiles().isEmpty())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
        MeResponse response = new MeResponse(identity.id(), user.getIdToken().getClaimAsString("name"),
                user.getIdToken().getClaimAsString("email"),
                user.getIdToken().getClaimAsString("picture"), identity.profiles());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response);
    }

    @GetMapping("/api/v1/auth/csrf")
    public ResponseEntity<CsrfToken> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(token);
    }

    public record MeResponse(UUID id, String nome, String email, String fotoUrl, List<String> perfis) {
    }
}
