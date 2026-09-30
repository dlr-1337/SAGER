package br.edu.ifgoiano.sager.operations;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Providers return only exits approved and physically effective at the requested instant. */
public interface AuthorizedExitLookup {
    List<Reference> authorizedFor(UUID residentId, Instant at);

    record Reference(UUID id, String type) {
        public Reference {
            if (id == null || (!"SHORT".equals(type) && !"LONG".equals(type))) {
                throw new IllegalArgumentException("Referência de saída inválida.");
            }
        }
    }
}
