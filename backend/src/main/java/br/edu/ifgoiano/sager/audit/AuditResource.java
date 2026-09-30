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
            "actualReturnAt", "lateObservation", "cancellationReason", "expiryReason")),
    OCCURRENCE(Set.of("residentId", "sourceId", "sourceType", "sourceVersion", "evidence", "status")),
    DISCIPLINE_NOTIFICATION(Set.of("occurrenceId", "status", "requiresReview", "reason")),
    WARNING(Set.of("residentId", "occurrenceId", "notificationId", "category", "severity",
            "description", "justification", "warningDate", "status", "reason")),
    NOTICE(Set.of("title", "body", "residentIds", "status", "contentVersion", "reason")),
    COMMUNICATION(Set.of("contentVersion", "residentId", "readAt", "acknowledgedAt", "status", "reason")),
    COMMITMENT_TERM(Set.of("residentId", "warningIds", "decision", "document", "status", "reason")),
    LONG_EXIT(Set.of("residentId", "guardianId", "departureMode", "requestedDepartureAt", "expectedReturnAt",
            "reason", "notes", "status", "decision", "decisionComment", "actualDepartureAt",
            "actualReturnAt", "lateObservation", "cancellationReason", "expiryReason", "documentVersionId")),
    DOCUMENT_VERSION(Set.of("exitId", "revisionNumber", "originalState", "signedState", "originalHash", "signedHash")),
    SIGNATURE_BINDING(Set.of("exitId", "documentVersionId", "guardianId", "status", "expiresAt", "revokedAt",
            "envelopeId", "providerDocumentId", "signerId", "verifiedAt", "signedAt", "tokenHash")),
    WHATSAPP_ATTEMPT(Set.of("bindingId", "status", "providerMessageId", "acceptedAt", "deliveredAt", "readAt", "failureCode")),
    INTEGRATION_TASK(Set.of("bindingId", "type", "state", "attemptCount", "leaseUntil", "nextAttemptAt", "failureCode")),
    HEALTH_GRANT(Set.of("accountId", "profession", "registrationNumber", "registrationRegion",
            "verificationReason", "endedAt", "endReason")),
    CARE_ASSIGNMENT(Set.of("residentId", "professionalGrantId", "reason", "endedAt", "endReason")),
    HEALTH_CUSTODY(Set.of("residentId", "sourceAuthorAccountId", "recipientGrantId", "reason",
            "endedAt", "endReason")),
    HEALTH_NOTE(Set.of("residentId", "category", "body", "relatedNoteId", "reason"), true),
    HEALTH_SHARE(Set.of("noteId", "recipientGrantId", "recipientCareAssignmentId", "endedAt"), true),
    HEALTH_EXPORT(Set.of("notes", "versions"), true);

    private final Set<String> fields;
    private final boolean protectedHealthContent;

    AuditResource(Set<String> fields) {
        this(fields, false);
    }

    AuditResource(Set<String> fields, boolean protectedHealthContent) {
        this.fields = fields;
        this.protectedHealthContent = protectedHealthContent;
    }

    public Set<String> fields() {
        return fields;
    }

    public boolean protectedHealthContent() {
        return protectedHealthContent;
    }
}
