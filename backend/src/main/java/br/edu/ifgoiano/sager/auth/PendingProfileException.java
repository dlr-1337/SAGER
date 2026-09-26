package br.edu.ifgoiano.sager.auth;

import java.util.UUID;

import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

public final class PendingProfileException extends OAuth2AuthenticationException {
    private final UUID requestId;

    public PendingProfileException(UUID requestId) {
        super(new OAuth2Error("pending_local_profile"), "Perfil local pendente");
        this.requestId = requestId;
    }

    public UUID requestId() {
        return requestId;
    }
}
