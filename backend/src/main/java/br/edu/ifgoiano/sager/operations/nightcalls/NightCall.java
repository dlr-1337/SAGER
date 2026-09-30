package br.edu.ifgoiano.sager.operations.nightcalls;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import br.edu.ifgoiano.sager.operations.AuthorizedExitLookup;

public record NightCall(UUID id, UUID accommodationId, String accommodationName,
        LocalDate referenceDate, String status, long version, Instant openedAt, UUID openedBy,
        Instant closedAt, UUID closedBy, boolean outsideWindowConfirmed, String justification,
        boolean closeOutsideWindowConfirmed, String closeJustification, Summary summary,
        List<ResidentMark> records) {

    public NightCall view(List<ResidentMark> residents) {
        int present = 0;
        int absent = 0;
        int justified = 0;
        int unmarked = 0;
        for (ResidentMark resident : residents) {
            if (resident.mark() == null) unmarked++;
            else switch (resident.mark()) {
                case "PRESENTE" -> present++;
                case "AUSENTE" -> absent++;
                case "AUSENCIA_JUSTIFICADA" -> justified++;
                default -> throw new IllegalStateException("Marcação persistida inválida.");
            }
        }
        return new NightCall(id, accommodationId, accommodationName, referenceDate, status, version,
                openedAt, openedBy, closedAt, closedBy, outsideWindowConfirmed, justification,
                closeOutsideWindowConfirmed, closeJustification,
                new Summary(residents.size(), present, absent, justified, unmarked), List.copyOf(residents));
    }

    public record ResidentMark(UUID id, UUID residentId, String residentName, String enrollment,
            LocalDate birthDate, UUID roomId, String roomNumber, String mark, UUID authorizedExitId,
            String authorizedExitType, long version, List<MarkHistory> history,
            List<AuthorizedExitLookup.Reference> authorizedExits) {
    }

    public record MarkHistory(UUID id, String mark, UUID authorizedExitId, String authorizedExitType,
            String justification, Instant recordedAt, UUID actorId, String actorProfile,
            long version, long callVersion) {
    }

    public record Summary(int total, int present, int absent, int justified, int unmarked) {
    }

    public record AccommodationOption(UUID id, String code, String name) {
    }

    public record MissingBirthDate(UUID residentId, String residentName, String enrollment, String roomNumber) {
    }

    public record Context(UUID accommodationId, LocalDate referenceDate, Instant now, String zone,
            LocalTime windowStart, LocalTime windowEnd, boolean outsideWindow, UUID existingCallId,
            int eligibleResidents, List<AccommodationOption> accommodations,
            List<MissingBirthDate> missingBirthDates) {
    }
}
