package br.edu.ifgoiano.sager.audit;

import java.util.Set;

public enum AuditResource {
    SUPERVISOR(Set.of("name", "institutionalId", "email")),
    RESIDENT(Set.of("name", "enrollment", "birthDate", "course", "courseId", "institutionalEmail", "entryYear",
            "extraSemesters")),
    COURSE(Set.of("name", "active", "level", "durationYears")),
    GUARDIAN(Set.of("residentId", "name", "relationship", "phone", "active")),
    ACCOMMODATION(Set.of("code", "name", "ageGroup")),
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
    CLEANING_ASSESSMENT(Set.of("roomId", "evaluatedAt", "criteria", "score", "observation", "participantIds", "reason")),
    REPORT_SNAPSHOT(Set.of("catalogCode", "filters", "rowCount", "expiresAt")),
    REPORT_EXPORT(Set.of("snapshotId", "format", "status", "document", "reason")),
    LONG_EXIT(Set.of("residentId", "guardianId", "departureMode", "requestedDepartureAt", "expectedReturnAt",
            "reason", "notes", "status", "decision", "decisionComment", "actualDepartureAt",
            "actualReturnAt", "lateObservation", "cancellationReason", "expiryReason", "documentVersionId")),
    DOCUMENT_VERSION(Set.of("exitId", "revisionNumber", "originalState", "signedState", "originalHash", "signedHash",
            "signedMediaType")),
    SIGNATURE_BINDING(Set.of("exitId", "documentVersionId", "guardianId", "status", "expiresAt", "revokedAt",
            "envelopeId", "providerDocumentId", "signerId", "verifiedAt", "verifiedBy", "signedAt", "evidenceHash",
            "tokenHash")),
    AUTHORIZATION_FILE(Set.of("exitId", "documentVersionId", "bindingId", "messageId", "origin", "state", "fileHash",
            "mediaType", "decidedBy", "decidedAt", "decisionReason")),
    WHATSAPP_CONVERSATION(Set.of("guardianId", "chatId")),
    WHATSAPP_MESSAGE(Set.of("conversationId", "deliveryStatus", "mediaType", "fileHash", "providerMessageId", "failureCode")),
    WHATSAPP_SESSION(Set.of("started", "qrRead", "ended")),
    WHATSAPP_ATTEMPT(Set.of("bindingId", "status", "providerMessageId", "acceptedAt", "deliveredAt", "readAt", "failureCode")),
    INTEGRATION_TASK(Set.of("bindingId", "type", "state", "attemptCount", "leaseUntil", "nextAttemptAt", "failureCode"));

    private final Set<String> fields;

    AuditResource(Set<String> fields) {
        this.fields = fields;
    }

    public Set<String> fields() {
        return fields;
    }
}
