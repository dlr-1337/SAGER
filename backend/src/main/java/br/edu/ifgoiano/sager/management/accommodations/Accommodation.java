package br.edu.ifgoiano.sager.management.accommodations;

import java.util.UUID;

public record Accommodation(UUID id, String code, String name, long version) {
}
