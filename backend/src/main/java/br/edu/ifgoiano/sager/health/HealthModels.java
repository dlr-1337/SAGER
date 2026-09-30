package br.edu.ifgoiano.sager.health;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class HealthModels {
    private HealthModels() {}

    public enum Profession { MEDICINA, ENFERMAGEM, PSICOLOGIA }

    public enum Category {
        GENERAL, PSYCHOLOGICAL, SHARED_SUMMARY;

        public boolean allows(Profession profession) {
            return this == SHARED_SUMMARY || (this == PSYCHOLOGICAL
                    ? profession == Profession.PSICOLOGIA : profession != Profession.PSICOLOGIA);
        }
    }

    public record Page<T>(List<T> items, Object nextCursor, long totalCount) {}

    public record Grant(UUID id, long sequence, UUID accountId, String accountName, Profession profession,
            String registrationNumber, String registrationRegion, UUID verifiedBy, Instant verifiedAt,
            String verificationReason, Instant startedAt, Instant endedAt, long version) {}

    public record Assignment(UUID id, long sequence, UUID residentId, String residentName,
            UUID professionalGrantId, UUID accountId, String accountName, Profession profession,
            Instant startedAt, Instant endedAt, UUID createdBy, String reason, long version) {}

    public record Custody(UUID id, long sequence, UUID residentId, UUID sourceAuthorAccountId,
            UUID recipientGrantId, String recipientAccountName, UUID createdBy, Instant createdAt,
            String reason, Instant endedAt, long version) {}

    public record AccountChoice(UUID id, String name, String email, String profile) {}

    public record ResidentHeader(UUID id, String name, String enrollment, LocalDate birthDate,
            Instant lastRecordedAt, Instant reviewAfter) {}

    public record ProfessionalChoice(UUID accountId, UUID grantId, UUID careAssignmentId,
            String name, Profession profession) {}

    public record ProfessionalChoices(List<ProfessionalChoice> items) {}

    public record Capabilities(Grant professionalGrant, boolean canAdministerAccess,
            boolean canAccessOwnRecord) {}

    public record NoteSummary(UUID id, long sequence, UUID residentId, Category category,
            UUID authorAccountId, String authorName, Profession authorProfession,
            String authorRegistrationNumber, String authorRegistrationRegion, Instant createdAt,
            Instant updatedAt, long version, UUID relatedNoteId, boolean canCorrect,
            boolean canShare, boolean custodyAccess) {}

    public record NoteDetail(UUID id, long sequence, UUID residentId, Category category,
            UUID authorAccountId, String authorName, Profession authorProfession,
            String authorRegistrationNumber, String authorRegistrationRegion, Instant createdAt,
            Instant updatedAt, long version, UUID relatedNoteId, boolean canCorrect,
            boolean canShare, boolean custodyAccess, String body, List<Share> shares) {}

    public record Revision(UUID id, UUID noteId, long version, String body, String reason,
            Instant recordedAt, UUID recordedBy) {}

    public record Share(UUID id, UUID recipientGrantId, UUID recipientCareAssignmentId,
            String recipientName, Profession profession,
            Instant createdAt, Instant endedAt, long version) {}

    public record ExportNote(NoteDetail note, List<Revision> history) {}

    public record Export(UUID exportId, Instant generatedAt, UUID requestId, ResidentHeader resident,
            List<ExportNote> notes) {}

    record Actor(UUID id, String email, String name, String profile, boolean active,
            UUID residentId, UUID supervisorId) {}

    record Access(Actor actor, Grant grant, Assignment assignment, UUID residentId, boolean patient) {}

    record NoteRow(UUID id, long sequence, UUID residentId, Category category, UUID authorAccountId,
            UUID authorGrantId, String authorName, Profession authorProfession,
            String authorRegistrationNumber, String authorRegistrationRegion, Instant createdAt,
            UUID relatedNoteId, long version, String body, Instant updatedAt) {}
}
