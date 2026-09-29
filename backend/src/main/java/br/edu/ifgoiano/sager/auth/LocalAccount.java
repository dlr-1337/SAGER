package br.edu.ifgoiano.sager.auth;

import java.util.UUID;

public record LocalAccount(UUID id, String email, String name, String passwordHash,
        String profile, boolean active) {
}
