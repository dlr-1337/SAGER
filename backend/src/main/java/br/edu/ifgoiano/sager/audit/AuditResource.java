package br.edu.ifgoiano.sager.audit;

import java.util.Set;

public enum AuditResource {
    SUPERVISOR(Set.of("name", "institutionalId", "email")),
    RESIDENT(Set.of("name", "enrollment", "birthDate", "course")),
    GUARDIAN(Set.of("residentId", "name", "relationship", "phone", "active")),
    ACCOMMODATION(Set.of("code", "name")),
    ACCOMMODATION_UNIT(Set.of("accommodationId", "code", "name")),
    ROOM(Set.of("code", "number", "accommodationId", "unitId", "floor", "capacity", "situation")),
    ALLOCATION(Set.of("residentId", "roomId", "startedAt", "endedAt", "endReason")),
    NIGHT_CALL(Set.of("accommodationId", "referenceDate", "status", "closedAt",
            "outsideWindowConfirmed", "justification")),
    NIGHT_CALL_MARK(Set.of("callId", "residentId", "mark", "authorizedExitId",
            "authorizedExitType", "justification")),
    SHORT_EXIT(Set.of("residentId", "departureMode", "requestedDepartureAt", "expectedReturnAt",
            "reason", "notes", "status", "decision", "decisionComment", "actualDepartureAt",
            "actualReturnAt", "lateObservation", "cancellationReason", "expiryReason"));

    private final Set<String> fields;

    AuditResource(Set<String> fields) {
        this.fields = fields;
    }

    public Set<String> fields() {
        return fields;
    }
}
