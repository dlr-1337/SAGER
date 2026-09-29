package br.edu.ifgoiano.sager.management.accommodations;

import java.util.UUID;

public record AccommodationUnit(UUID id, UUID accommodationId, String code, String name,
        long version) {
}
