package br.edu.ifgoiano.sager.management.allocations;

import java.time.OffsetDateTime;
import java.util.UUID;

public record Allocation(UUID id, UUID residentId, UUID roomId, OffsetDateTime startedAt,
        OffsetDateTime endedAt, String endReason, long version) {
}
