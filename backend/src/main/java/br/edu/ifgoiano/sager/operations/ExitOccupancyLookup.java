package br.edu.ifgoiano.sager.operations;

import java.time.Instant;
import java.util.UUID;

/** Consulted for every exit type while the shared resident row is locked. */
public interface ExitOccupancyLookup {
    boolean physicalOpenFor(UUID residentId);

    boolean overlaps(UUID residentId, AuthorizedExitLookup.Reference excluded,
            Instant departure, Instant returning, Instant now);
}
