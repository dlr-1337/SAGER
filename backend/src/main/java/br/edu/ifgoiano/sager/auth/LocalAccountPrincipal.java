package br.edu.ifgoiano.sager.auth;

import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;

public record LocalAccountPrincipal(UUID id, String email, String name, String profile,
        UUID residentId, UUID supervisorId, String enrollment)
        implements Principal, Serializable {
    private static final long serialVersionUID = 1L;

    @Override
    public String getName() {
        return id.toString();
    }
}
