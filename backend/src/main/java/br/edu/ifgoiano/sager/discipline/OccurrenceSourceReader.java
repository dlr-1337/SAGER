package br.edu.ifgoiano.sager.discipline;

import java.time.OffsetDateTime;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

/** Additional domain modules expose trusted origin snapshots; clients never supply these. */
public interface OccurrenceSourceReader {
    boolean supports(String sourceType);
    Evidence read(String sourceType, UUID sourceId, UUID residentId);
    record Evidence(String category, long sourceVersion, OffsetDateTime occurredAt,
            boolean qualifies, JsonNode snapshot) {}
}
