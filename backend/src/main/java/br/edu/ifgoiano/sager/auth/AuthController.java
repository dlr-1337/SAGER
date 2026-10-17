package br.edu.ifgoiano.sager.auth;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.context.annotation.Profile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@Profile({ "local", "production" })
public class AuthController {
    private final LocalAccountRepository accounts;

    public AuthController(LocalAccountRepository accounts) {
        this.accounts = accounts;
    }

    @GetMapping("/api/v1/auth/me")
    public ResponseEntity<MeResponse> me(@AuthenticationPrincipal LocalAccountPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        LocalAccount account = accounts.findById(principal.id())
                .filter(value -> value.active() && Objects.equals(value.enrollment(), principal.enrollment())
                        && value.profile().equals(principal.profile())
                        && Objects.equals(value.residentId(), principal.residentId())
                        && Objects.equals(value.supervisorId(), principal.supervisorId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        MeResponse response = new MeResponse(account.id(), account.name(), account.email(),
                null, List.of(account.profile()), account.residentId(), account.supervisorId(), account.enrollment());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response);
    }

    @GetMapping("/api/v1/auth/csrf")
    public ResponseEntity<CsrfToken> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(token);
    }

    public record MeResponse(UUID id, String nome, String email, String fotoUrl, List<String> perfis,
            UUID residenteId, UUID supervisorId, String matricula) {
    }
}
