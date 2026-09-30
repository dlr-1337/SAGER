package br.edu.ifgoiano.sager.audit;

import java.util.Set;

public enum AuditResource {
    SUPERVISOR(Set.of("name", "institutionalId", "email")),
    RESIDENT(Set.of("name", "enrollment", "birthDate", "course")),
    GUARDIAN(Set.of("residentId", "name", "relationship", "phone", "active")),
    ACCOMMODATION(Set.of("code", "name")),
    ACCOMMODATION_UNIT(Set.of("accommodationId", "code", "name")),
    ROOM(Set.of("code", "number", "accommodationId", "unitId", "floor", "capacity", "situation")),
    ALLOCATION(Set.of("residentId", "roomId", "startedAt", "endedAt", "endReason"));

    private final Set<String> fields;

    AuditResource(Set<String> fields) {
        this.fields = fields;
    }

    public Set<String> fields() {
        return fields;
    }
}
