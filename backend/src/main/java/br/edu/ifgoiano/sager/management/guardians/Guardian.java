package br.edu.ifgoiano.sager.management.guardians;

import java.util.UUID;

public record Guardian(UUID id, UUID residentId, String name, String relationship,
        String phone, boolean active, long version) {
}
