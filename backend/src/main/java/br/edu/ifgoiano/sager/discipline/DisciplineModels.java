package br.edu.ifgoiano.sager.discipline;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import br.edu.ifgoiano.sager.documents.StoredFile;
import tools.jackson.databind.JsonNode;

public final class DisciplineModels {
    private DisciplineModels() {}
    public record Page<T>(List<T> items, Long nextCursor) {}
    public record Context(OffsetDateTime now, LocalDate currentDate, String zone,
            List<String> categories, List<String> severities) {}
    public record Revision(long version, long sourceVersion, boolean valid, JsonNode evidence,
            OffsetDateTime occurredAt, OffsetDateTime recordedAt) {}
    public record Occurrence(UUID id, UUID residentId, String residentName, String sourceType,
            UUID sourceId, String category, boolean valid, long sourceVersion, long version,
            OffsetDateTime occurredAt, JsonNode evidence, List<Revision> revisions) {}
    public record Event(UUID id, String action, UUID actorId, OffsetDateTime recordedAt,
            long resultingVersion, long occurrenceVersion, String reasonCode, String reason) {}
    public record Notification(UUID id, UUID occurrenceId, UUID residentId, String residentName,
            String category, String status, boolean requiresReview, long version,
            long occurrenceVersion, String policyCode, long policyVersion,
            OffsetDateTime createdAt, boolean valid, JsonNode evidence, List<Event> events) {}
    public record Warning(UUID id, UUID residentId, String residentName, UUID occurrenceId,
            UUID notificationId, String category, String severity, String description,
            String justification, LocalDate warningDate, String status, boolean requiresReview,
            OffsetDateTime issuedAt, UUID issuedBy, UUID communicationId, long version,
            String annulmentReason) {}
    public record Recurrence(String category, int minimumWarnings, int windowDays,
            List<Warning> warnings, boolean candidate) {}
    public record Term(UUID id, UUID residentId, String residentName, List<UUID> warningIds,
            String decision, String status, OffsetDateTime issuedAt, UUID issuedBy,
            UUID communicationId, StoredFile document, long version, String annulmentReason) {}
}
