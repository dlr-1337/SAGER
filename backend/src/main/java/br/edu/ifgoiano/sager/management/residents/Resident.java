package br.edu.ifgoiano.sager.management.residents;

import java.time.LocalDate;
import java.util.UUID;

public record Resident(UUID id, String name, String enrollment, LocalDate birthDate,
        String course, long version, UUID courseId, String institutionalEmail) {
}
