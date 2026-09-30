package br.edu.ifgoiano.sager.operations;

import java.util.UUID;

/** Called by origin services inside their transaction, after the origin has been saved. */
public interface OccurrenceEvidenceSink {
    void reconcile(String sourceType, UUID sourceId, UUID residentId);
}
