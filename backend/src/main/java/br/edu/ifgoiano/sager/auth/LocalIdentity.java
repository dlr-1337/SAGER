package br.edu.ifgoiano.sager.auth;

import java.util.List;
import java.util.UUID;

public record LocalIdentity(UUID id, boolean active, List<String> profiles) {
    public LocalIdentity {
        profiles = List.copyOf(profiles);
    }
}
