package br.edu.ifgoiano.sager.management.supervisors;

import java.util.UUID;

public record Supervisor(UUID id, String name, String institutionalId, String email, long version) {
}
