package br.edu.ifgoiano.sager.communications;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import br.edu.ifgoiano.sager.documents.StoredFile;

public final class CommunicationModels {
    private CommunicationModels() {}
    public record Notice(UUID id, String title, String body, List<UUID> residentIds,
            String status, long version, OffsetDateTime publishedAt, UUID communicationId,
            String withdrawalReason) {}
    public record Communication(UUID id, String kind, UUID sourceId, long contentVersion,
            String title, String body, OffsetDateTime publishedAt, String status,
            String stateReason, boolean requiresReview, OffsetDateTime readAt, OffsetDateTime acknowledgedAt,
            StoredFile document) {}
}
