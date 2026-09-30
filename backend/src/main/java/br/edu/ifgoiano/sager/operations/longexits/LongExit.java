package br.edu.ifgoiano.sager.operations.longexits;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record LongExit(
        UUID id,
        UUID residentId,
        String residentName,
        String enrollment,
        UUID guardianId,
        String guardianName,
        String guardianRelationship,
        String departureMode,
        Instant requestedDepartureAt,
        Instant expectedReturnAt,
        String reason,
        String notes,
        String status,
        String decision,
        String decisionComment,
        Instant decidedAt,
        Instant actualDepartureAt,
        Instant actualReturnAt,
        String lateObservation,
        String cancellationReason,
        String expiryReason,
        Instant createdAt,
        Instant updatedAt,
        long version,
        Instant departureRecordedAt,
        Instant returnRecordedAt,
        Instant deadlineAt,
        boolean deadlinePassed,
        Instant now,
        String zone,
        Document currentDocument,
        String signatureStatus,
        String messageStatus,
        Instant signedAt,
        Instant resendAvailableAt,
        int remainingResends,
        Capabilities capabilities,
        List<Binding> bindings,
        List<History> history) {
    public static final String PENDING = "AGUARDANDO_ANALISE";
    public static final String APPROVED = "APROVADA";
    public static final String IN_PROGRESS = "EM_ANDAMENTO";

    public Instant deadline() {
        return PENDING.equals(status)
                ? ("SCHEDULED".equals(departureMode) ? requestedDepartureAt : expectedReturnAt)
                : APPROVED.equals(status) ? expectedReturnAt : null;
    }

    public record Document(
            UUID documentVersionId, int revisionNumber, String originalState, String signedState) {}

    public record Capabilities(
            boolean canEdit,
            boolean canApprove,
            boolean canReject,
            boolean canCancel,
            boolean canDepart,
            boolean canReturn,
            boolean canResend,
            boolean canReconcile,
            boolean canDownloadOriginal,
            boolean canDownloadSigned) {}

    public record Binding(
            UUID id,
            UUID documentVersionId,
            UUID guardianId,
            String guardianName,
            String status,
            String messageStatus,
            Instant expiresAt,
            Instant createdAt,
            Instant revokedAt,
            Instant signedAt,
            Instant verifiedAt,
            String failureCode,
            boolean widgetAvailable) {}

    public record History(
            UUID id,
            String event,
            long version,
            Instant recordedAt,
            Instant effectiveAt,
            UUID actorId,
            String actorProfile,
            String origin,
            String justification,
            UUID guardianId,
            UUID documentVersionId,
            String departureMode,
            Instant requestedDepartureAt,
            Instant expectedReturnAt,
            String reason,
            String notes,
            String status,
            String decision,
            String decisionComment,
            Instant actualDepartureAt,
            Instant actualReturnAt,
            String lateObservation,
            String cancellationReason,
            String expiryReason) {}
}
