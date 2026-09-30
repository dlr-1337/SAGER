package br.edu.ifgoiano.sager.audit;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AuditEvent(long sequence, UUID id, Instant occurredAt, UUID actorId,
        String actorProfile, String origin, UUID requestId, AuditResource resource, UUID resourceId,
        AuditAction action, long resultingVersion, List<String> changedFields) {
    public AuditEvent {
        changedFields = List.copyOf(changedFields);
    }
}
