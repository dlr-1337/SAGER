package br.edu.ifgoiano.sager.integrations;

import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.DocumentRow;

import java.time.Instant;
import java.util.UUID;

public interface SignatureProvider {
    boolean available();

    String environment();

    UUID prepare(
            String stage,
            IntegrationRepository.BindingData binding,
            DocumentRow document,
            byte[] original);

    VerifiedSignature inspect(IntegrationRepository.BindingData binding);

    void cancel(IntegrationRepository.BindingData binding);

    record VerifiedSignature(
            UUID documentId,
            UUID signerId,
            Instant signedAt,
            String evidenceHash,
            byte[] signedPdf,
            String originalHash) {}
}
