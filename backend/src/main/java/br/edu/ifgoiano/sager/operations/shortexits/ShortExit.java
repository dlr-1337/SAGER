package br.edu.ifgoiano.sager.operations.shortexits;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ShortExit(UUID id, UUID residentId, String residentName, String enrollment,
        String departureMode, Instant requestedDepartureAt, Instant expectedReturnAt, String reason,
        String notes, String status, String decision, String decisionComment, Instant decidedAt,
        Instant actualDepartureAt, Instant actualReturnAt, String lateObservation,
        String cancellationReason, String expiryReason, Instant createdAt, Instant updatedAt,
        long version, Instant departureRecordedAt, Instant returnRecordedAt, Instant deadlineAt,
        boolean deadlinePassed, Instant now, String zone, Capabilities capabilities, List<History> history) {

    public static final String PENDING = "AGUARDANDO_ANALISE";
    public static final String APPROVED = "APROVADA";
    public static final String IN_PROGRESS = "EM_ANDAMENTO";

    public Instant deadline() {
        if (PENDING.equals(status)) {
            return "SCHEDULED".equals(departureMode) ? requestedDepartureAt : expectedReturnAt;
        }
        return APPROVED.equals(status) ? expectedReturnAt : null;
    }

    public ShortExit view(Instant now, Capabilities permissions, List<History> events) {
        Instant deadline = deadline();
        Instant departureRecorded = events.stream().filter(event -> "DEPARTURE".equals(event.event()))
                .map(History::recordedAt).findFirst().orElse(null);
        Instant returnRecorded = events.stream().filter(event -> "RETURN".equals(event.event()))
                .map(History::recordedAt).findFirst().orElse(null);
        return new ShortExit(id, residentId, residentName, enrollment, departureMode,
                requestedDepartureAt, expectedReturnAt, reason, notes, status, decision, decisionComment,
                decidedAt, actualDepartureAt, actualReturnAt, lateObservation, cancellationReason,
                expiryReason, createdAt, updatedAt, version, departureRecorded, returnRecorded, deadline,
                deadline != null && !now.isBefore(deadline), now, "America/Sao_Paulo", permissions, List.copyOf(events));
    }

    public record Capabilities(boolean canEdit, boolean canDecide, boolean canCancel,
            boolean canDepart, boolean canReturn) {
    }

    public record History(UUID id, String event, long version, Instant recordedAt, Instant effectiveAt,
            UUID actorId, String actorProfile, String origin, String justification, String departureMode,
            Instant requestedDepartureAt, Instant expectedReturnAt, String reason, String notes,
            String status, String decision, String decisionComment, Instant actualDepartureAt,
            Instant actualReturnAt, String lateObservation, String cancellationReason, String expiryReason) {
    }
}
