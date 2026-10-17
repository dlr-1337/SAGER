package br.edu.ifgoiano.sager.health;

import static br.edu.ifgoiano.sager.health.HealthModels.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditContextProvider;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
@Transactional
public class HealthService {
    private final HealthRepository repository;
    private final AuditService audit;
    private final AuditContextProvider contexts;

    public HealthService(HealthRepository repository, AuditService audit, AuditContextProvider contexts) {
        this.repository = repository;
        this.audit = audit;
        this.contexts = contexts;
    }

    public Capabilities capabilities() {
        Actor actor = actor();
        return new Capabilities(repository.currentGrant(actor.id()).orElse(null),
                administrator(actor), actor.residentId() != null);
    }

    public Page<AccountChoice> accounts(String query, UUID afterId, int limit) {
        administrator(); bounds(limit, null, false);
        return repository.accounts(search(query), afterId, limit);
    }

    public Page<Grant> grants(UUID accountId, int limit, Long cursor) {
        administrator(); bounds(limit, cursor, false);
        return repository.grants(accountId, limit, cursor);
    }

    public Grant createGrant(UUID accountId, Profession profession, String number, String region, String reason) {
        Actor administrator = administrator();
        repository.lockAccountEpisode(accountId);
        Actor target = repository.account(accountId, true).filter(Actor::active).orElseThrow(HealthService::missing);
        if (repository.currentGrant(target.id()).isPresent()) throw conflict();
        Grant grant = insert(() -> repository.insertGrant(target.id(), profession, number, region,
                administrator.id(), reason));
        audit.record(AuditResource.HEALTH_GRANT, grant.id(), AuditAction.CREATE, grant.version(),
                Set.of("accountId", "profession", "registrationNumber", "registrationRegion", "verificationReason"));
        return grant;
    }

    public Grant endGrant(UUID id, long version, String reason) {
        administrator();
        Grant grant = repository.grant(id, true, false).orElseThrow(HealthService::missing);
        if (grant.version() != version || grant.endedAt() != null || !repository.endGrant(id, version, reason))
            throw conflict();
        Grant ended = repository.grant(id, false, false).orElseThrow();
        audit.record(AuditResource.HEALTH_GRANT, id, AuditAction.END, ended.version(),
                Set.of("endedAt", "endReason"));
        return ended;
    }

    public Page<Assignment> assignments(UUID residentId, int limit, Long cursor) {
        administrator(); bounds(limit, cursor, false);
        return repository.assignments(residentId, limit, cursor);
    }

    public Assignment createAssignment(UUID residentId, UUID grantId, String reason) {
        Actor administrator = administrator();
        Grant grant = repository.grant(grantId, true, true).orElseThrow(HealthService::missing);
        repository.resident(residentId).orElseThrow(HealthService::missing);
        if (repository.assignment(residentId, grantId, true).isPresent()) throw conflict();
        Assignment assignment = insert(() -> repository.insertAssignment(residentId, grant, administrator.id(), reason));
        audit.record(AuditResource.CARE_ASSIGNMENT, assignment.id(), AuditAction.CREATE, assignment.version(),
                Set.of("residentId", "professionalGrantId", "reason"));
        return assignment;
    }

    public Assignment endAssignment(UUID id, long version, String reason) {
        administrator();
        Assignment initial = repository.assignment(id, false).orElseThrow(HealthService::missing);
        repository.grant(initial.professionalGrantId(), true, false).orElseThrow(HealthService::missing);
        Assignment assignment = repository.assignment(id, true).orElseThrow(HealthService::missing);
        if (assignment.version() != version || assignment.endedAt() != null
                || !repository.endAssignment(id, version, reason)) throw conflict();
        Assignment ended = repository.assignment(id, false).orElseThrow();
        audit.record(AuditResource.CARE_ASSIGNMENT, id, AuditAction.END, ended.version(), Set.of("endedAt", "endReason"));
        return ended;
    }

    public Page<Custody> custodies(UUID residentId, int limit, Long cursor) {
        administrator(); bounds(limit, cursor, false);
        return repository.custodies(residentId, limit, cursor);
    }

    public Custody createCustody(UUID residentId, UUID sourceAccountId, UUID recipientGrantId, String reason) {
        Actor administrator = administrator();
        repository.lockAccountEpisode(sourceAccountId);
        Actor source = repository.account(sourceAccountId, true).orElseThrow(HealthService::missing);
        Grant recipient = repository.grant(recipientGrantId, false, true).orElseThrow(HealthService::missing);
        if (recipient.accountId().equals(sourceAccountId)) throw forbidden();
        Grant sourceGrant = source.active() ? repository.currentGrant(sourceAccountId).orElse(null) : null;
        if (sourceGrant != null && repository.assignment(residentId, sourceGrant.id(), false).isPresent())
            throw new HealthApiException(HttpStatus.CONFLICT, "author_still_assigned",
                    "O autor ainda possui habilitação e vínculo assistencial vigentes.");
        Assignment assignment = repository.assignment(residentId, recipient.id(), false)
                .orElseThrow(HealthService::missing);
        List<Category> categories = repository.sourceCategories(residentId, sourceAccountId);
        if (categories.isEmpty()) throw missing();
        if (categories.stream().anyMatch(category -> !category.allows(recipient.profession()))) throw forbidden();
        Custody custody = insert(() -> repository.insertCustody(residentId, sourceAccountId,
                recipient, assignment, administrator.id(), reason));
        audit.record(AuditResource.HEALTH_CUSTODY, custody.id(), AuditAction.CREATE, custody.version(),
                Set.of("residentId", "sourceAuthorAccountId", "recipientGrantId", "reason"));
        return custody;
    }

    public Custody endCustody(UUID id, long version, String reason) {
        administrator();
        Custody initial = repository.custody(id, false).orElseThrow(HealthService::missing);
        repository.grant(initial.recipientGrantId(), true, false).orElseThrow(HealthService::missing);
        Custody custody = repository.custody(id, true).orElseThrow(HealthService::missing);
        if (custody.version() != version || custody.endedAt() != null
                || !repository.endCustody(id, version, reason)) throw conflict();
        Custody ended = repository.custody(id, false).orElseThrow();
        audit.record(AuditResource.HEALTH_CUSTODY, id, AuditAction.END, ended.version(), Set.of("endedAt", "endReason"));
        return ended;
    }

    public Page<ResidentHeader> residents(String query, UUID afterId, int limit) {
        Professional professional = professional(); bounds(limit, null, false);
        Page<ResidentHeader> page = repository.residents(professional.grant(), search(query), afterId, limit);
        List<ResidentHeader> residents = page.items().stream().map(header ->
                repository.resident(access(professional, header.id()))).toList();
        return new Page<>(residents, page.nextCursor(), page.totalCount());
    }

    public ResidentHeader resident(UUID id) { return repository.resident(access(professional(), id)); }

    public ProfessionalChoices professionals(UUID residentId, Category category) {
        access(professional(), residentId);
        return new ProfessionalChoices(repository.professionals(residentId, category));
    }

    public Page<NoteSummary> notes(UUID residentId, Category category, int limit, Long cursor, boolean own) {
        Access access = own ? patient() : access(professional(), residentId);
        bounds(limit, cursor, false);
        Page<NoteRow> page = repository.notes(access, category, limit, cursor);
        return new Page<>(page.items().stream().map(note -> summary(note, access)).toList(),
                page.nextCursor(), page.totalCount());
    }

    public NoteDetail createNote(UUID residentId, Category category, String body, UUID relatedNoteId) {
        Access access = access(professional(), residentId);
        if (!category.allows(access.grant().profession())) throw forbidden();
        if (relatedNoteId != null) authorizedNote(relatedNoteId, access, false);
        NoteRow note = insert(() -> repository.insertNote(access, category, relatedNoteId, body));
        audit.record(AuditResource.HEALTH_NOTE, note.id(), AuditAction.CREATE, note.version(),
                relatedNoteId == null ? Set.of("residentId", "category", "body")
                        : Set.of("residentId", "category", "body", "relatedNoteId"));
        audit.record(AuditResource.HEALTH_NOTE, note.id(), AuditAction.READ, note.version(), Set.of());
        return detail(note, access);
    }

    public NoteDetail note(UUID id, boolean own) {
        Access access = noteAccess(id, own);
        NoteRow note = authorizedNote(id, access, false);
        audit.record(AuditResource.HEALTH_NOTE, id, AuditAction.READ, note.version(), Set.of());
        return detail(note, access);
    }

    public Page<Revision> history(UUID id, int limit, Long cursor, boolean own) {
        Access access = noteAccess(id, own);
        NoteRow note = authorizedNote(id, access, false);
        bounds(limit, cursor, true);
        Page<Revision> history = repository.revisions(id, limit, cursor);
        for (Revision revision : history.items())
            audit.record(AuditResource.HEALTH_NOTE, id, AuditAction.READ, revision.version(), Set.of());
        return history;
    }

    public NoteDetail correct(UUID id, long version, String body, String reason) {
        Access access = noteAccess(id, false);
        NoteRow note = authorizedNote(id, access, true);
        author(note, access);
        if (note.version() != version) throw conflict();
        insert(() -> {
            repository.insertRevision(id, version + 1, body, reason, access.actor().id());
            return null;
        });
        NoteRow corrected = repository.note(id, false).orElseThrow();
        audit.record(AuditResource.HEALTH_NOTE, id, AuditAction.UPDATE, corrected.version(), Set.of("body", "reason"));
        audit.record(AuditResource.HEALTH_NOTE, id, AuditAction.READ, corrected.version(), Set.of());
        return detail(corrected, access);
    }

    public NoteDetail share(UUID id, long version, List<UUID> recipientGrantIds) {
        Professional professional = professional();
        UUID residentId = repository.noteResidentId(id).orElseThrow(HealthService::missing);
        List<Grant> recipients = recipientGrantIds.stream().sorted()
                .map(grantId -> repository.grant(grantId, false, true).orElseThrow(HealthService::missing)).toList();
        List<Assignment> assignments = recipients.stream().map(grant ->
                repository.assignment(residentId, grant.id(), false).orElseThrow(HealthService::missing)).toList();
        Access access = access(professional, residentId);
        NoteRow note = authorizedNote(id, access, true);
        author(note, access);
        if (note.version() != version) throw conflict();
        if (recipients.stream().anyMatch(grant -> !note.category().allows(grant.profession()))) throw forbidden();
        for (int index = 0; index < recipients.size(); index++) {
            Grant recipient = recipients.get(index);
            Assignment assignment = assignments.get(index);
            UUID shareId = insert(() -> repository.insertShare(note, recipient, assignment, access.actor().id()));
            audit.record(AuditResource.HEALTH_SHARE, shareId, AuditAction.CREATE, 0,
                    Set.of("noteId", "recipientGrantId", "recipientCareAssignmentId"));
        }
        audit.record(AuditResource.HEALTH_NOTE, id, AuditAction.READ, note.version(), Set.of());
        return detail(note, access);
    }

    public NoteDetail endShare(UUID id, UUID shareId, long version) {
        Access access = noteAccess(id, false);
        NoteRow note = authorizedNote(id, access, true);
        author(note, access);
        Share share = repository.share(shareId, id, true).orElseThrow(HealthService::missing);
        if (share.version() != version || share.endedAt() != null || !repository.endShare(shareId, version))
            throw conflict();
        audit.record(AuditResource.HEALTH_SHARE, shareId, AuditAction.END, version + 1, Set.of("endedAt"));
        audit.record(AuditResource.HEALTH_NOTE, id, AuditAction.READ, note.version(), Set.of());
        return detail(note, access);
    }

    public Export export(UUID residentId, boolean own) {
        Access access = own ? patient() : access(professional(), residentId);
        UUID exportId = UUID.randomUUID();
        List<ExportNote> notes = new ArrayList<>();
        for (UUID id : repository.noteIds(access)) {
            NoteRow note = authorizedNote(id, access, false);
            List<Revision> revisions = repository.allRevisions(id);
            notes.add(new ExportNote(detail(note, access), revisions));
            for (Revision revision : revisions)
                audit.record(AuditResource.HEALTH_NOTE, id, AuditAction.EXPORT, revision.version(), Set.of());
        }
        audit.record(AuditResource.HEALTH_EXPORT, exportId, AuditAction.EXPORT, 0, Set.of("notes", "versions"));
        return new Export(exportId, Instant.now(), contexts.requireContext().requestId(),
                repository.resident(access), notes);
    }

    private Access noteAccess(UUID id, boolean own) {
        if (own) {
            Access access = patient();
            UUID residentId = repository.noteResidentId(id).orElseThrow(HealthService::missing);
            if (!access.residentId().equals(residentId)) throw missing();
            return access;
        }
        Professional professional = professional();
        UUID residentId = repository.noteResidentId(id).orElseThrow(HealthService::missing);
        return access(professional, residentId);
    }

    private NoteRow authorizedNote(UUID id, Access access, boolean writeLock) {
        NoteRow note = repository.authorizedNote(id, access, writeLock).orElseThrow(HealthService::missing);
        if (!access.patient() && !note.authorAccountId().equals(access.actor().id())
                && !repository.shared(note, access, true) && !repository.custody(note, access, true)) throw missing();
        return note;
    }

    private Access access(Professional professional, UUID residentId) {
        Assignment assignment = repository.assignment(residentId, professional.grant().id(), false)
                .orElseThrow(HealthService::missing);
        return new Access(professional.actor(), professional.grant(), assignment, residentId, false);
    }

    private Access patient() {
        Actor actor = actor();
        if (actor.residentId() == null) throw forbidden();
        repository.resident(actor.residentId()).orElseThrow(HealthService::missing);
        return new Access(actor, null, null, actor.residentId(), true);
    }

    private Professional professional() {
        Actor actor = actor();
        Grant grant = repository.currentGrant(actor.id()).orElseThrow(HealthService::forbidden);
        return new Professional(actor, grant);
    }

    private Actor actor() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LocalAccountPrincipal principal))
            throw unauthorized();
        Actor actor = repository.account(principal.id(), true).filter(Actor::active).orElseThrow(HealthService::unauthorized);
        if (!java.util.Objects.equals(actor.email(), principal.email()) || !actor.profile().equals(principal.profile())
                || !Objects.equals(actor.residentId(), principal.residentId())
                || !Objects.equals(actor.supervisorId(), principal.supervisorId())) throw unauthorized();
        return actor;
    }

    private Actor administrator() {
        Actor actor = actor();
        if (!administrator(actor)) throw forbidden();
        return actor;
    }

    private boolean administrator(Actor actor) {
        return Set.of("gestor", "supervisor").contains(actor.profile());
    }

    private void author(NoteRow note, Access access) {
        if (!note.authorAccountId().equals(access.actor().id())
                || note.authorProfession() != access.grant().profession()) throw forbidden();
    }

    private NoteSummary summary(NoteRow note, Access access) {
        boolean author = !access.patient() && note.authorAccountId().equals(access.actor().id())
                && note.authorProfession() == access.grant().profession();
        boolean custody = !access.patient() && repository.custody(note, access, false);
        return new NoteSummary(note.id(), note.sequence(), note.residentId(), note.category(), note.authorAccountId(),
                note.authorName(), note.authorProfession(), note.authorRegistrationNumber(), note.authorRegistrationRegion(),
                note.createdAt(), note.updatedAt(), note.version(), note.relatedNoteId(), author, author, custody);
    }

    private NoteDetail detail(NoteRow note, Access access) {
        NoteSummary summary = summary(note, access);
        return new NoteDetail(summary.id(), summary.sequence(), summary.residentId(), summary.category(),
                summary.authorAccountId(), summary.authorName(), summary.authorProfession(),
                summary.authorRegistrationNumber(), summary.authorRegistrationRegion(), summary.createdAt(),
                summary.updatedAt(), summary.version(), summary.relatedNoteId(), summary.canCorrect(),
                summary.canShare(), summary.custodyAccess(), note.body(), repository.shares(note.id()));
    }

    private <T> T insert(Supplier<T> operation) {
        try { return operation.get(); }
        catch (DataIntegrityViolationException error) { throw conflict(); }
    }

    private void bounds(int limit, Long cursor, boolean revision) {
        if (limit < 1 || limit > 100 || (cursor != null && (revision ? cursor < 0 : cursor <= 0)))
            throw new HealthApiException(HttpStatus.BAD_REQUEST, "invalid_input", "Paginação inválida.");
    }

    private String search(String value) {
        String query = value == null ? "" : value.trim();
        if (query.length() > 100) throw new HealthApiException(HttpStatus.BAD_REQUEST, "invalid_input",
                "A busca deve ter no máximo 100 caracteres.");
        return query;
    }

    private static HealthApiException unauthorized() {
        return new HealthApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Sessão indisponível.");
    }

    private static HealthApiException forbidden() {
        return new HealthApiException(HttpStatus.FORBIDDEN, "forbidden", "Acesso não permitido.");
    }

    private static HealthApiException missing() {
        return new HealthApiException(HttpStatus.NOT_FOUND, "not_found", "Registro ou recurso não encontrado.");
    }

    private static HealthApiException conflict() {
        return new HealthApiException(HttpStatus.CONFLICT, "version_conflict",
                "O registro foi alterado ou o vínculo já está vigente. Atualize e tente novamente.");
    }

    private record Professional(Actor actor, Grant grant) {}
}
