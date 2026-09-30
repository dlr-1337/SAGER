package br.edu.ifgoiano.sager.operations.longexits;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import br.edu.ifgoiano.sager.documents.LongExitPdfGenerator;
import br.edu.ifgoiano.sager.documents.PdfGenerationException;
import br.edu.ifgoiano.sager.documents.PrivateFileException;
import br.edu.ifgoiano.sager.documents.PrivateFileStore;
import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository.BindingData;
import br.edu.ifgoiano.sager.integrations.SignatureProvider;
import br.edu.ifgoiano.sager.integrations.WhatsAppProvider;
import br.edu.ifgoiano.sager.operations.AuthorizedExitLookup;
import br.edu.ifgoiano.sager.operations.ExitOccupancyLookup;
import br.edu.ifgoiano.sager.operations.OperationResidents;
import br.edu.ifgoiano.sager.operations.OccurrenceEvidenceSink;
import br.edu.ifgoiano.sager.operations.OperationResidents.Eligibility;
import br.edu.ifgoiano.sager.operations.OpsActor;
import br.edu.ifgoiano.sager.operations.OpsInput;
import br.edu.ifgoiano.sager.operations.longexits.LongExitGuardians.Guardian;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.DocumentRow;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.Row;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Profile({ "local", "production" })
public class LongExitService {
    private static final Set<String> STATUSES =
            Set.of(
                    LongExit.PENDING,
                    LongExit.APPROVED,
                    LongExit.IN_PROGRESS,
                    "REJEITADA",
                    "CANCELADA",
                    "EXPIRADA",
                    "RETORNO_CONFIRMADO",
                    "RETORNO_CONFIRMADO_COM_ATRASO");
    private final LongExitRepository exits;
    private final LongExitGuardians guardians;
    private final OperationResidents residents;
    private final OpsActor actors;
    private final AuditService audit;
    private final Clock clock;
    private final List<ExitOccupancyLookup> occupancies;
    private final List<OccurrenceEvidenceSink> evidenceSinks;
    private final LongExitPdfGenerator pdf;
    private final PrivateFileStore files;
    private final IntegrationRepository integrations;
    private final SignatureProvider signature;
    private final WhatsAppProvider whatsapp;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public LongExitService(
            LongExitRepository exits,
            LongExitGuardians guardians,
            OperationResidents residents,
            OpsActor actors,
            AuditService audit,
            Clock clock,
            List<ExitOccupancyLookup> occupancies,
            List<OccurrenceEvidenceSink> evidenceSinks,
            LongExitPdfGenerator pdf,
            PrivateFileStore files,
            IntegrationRepository integrations,
            SignatureProvider signature,
            WhatsAppProvider whatsapp,
            JdbcTemplate jdbc,
            ObjectMapper json) {
        this.exits = exits;
        this.guardians = guardians;
        this.residents = residents;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.occupancies = List.copyOf(occupancies);
        this.evidenceSinks = List.copyOf(evidenceSinks);
        this.pdf = pdf;
        this.files = files;
        this.integrations = integrations;
        this.signature = signature;
        this.whatsapp = whatsapp;
        this.jdbc = jdbc;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public LongEligibility eligibility() {
        Eligibility r = residents.eligibility(actors.resident().residentId(), now());
        return new LongEligibility(
                r.residentId(),
                r.residentName(),
                r.enrollment(),
                r.birthDate(),
                r.roomId(),
                r.roomNumber(),
                r.accommodationId(),
                r.eligible(),
                r.blockers(),
                r.currentDate(),
                r.now(),
                r.zone(),
                guardians.list(r.residentId()),
                new Providers(signature.available(), whatsapp.available()));
    }

    @Transactional(readOnly = true)
    public List<LongExit> list(UUID residentId, String search, String status) {
        LocalAccountPrincipal a = reader();
        if ("residente".equals(a.profile())) {
            if (residentId != null && !residentId.equals(a.residentId())) throw OpsInput.notFound();
            residentId = a.residentId();
        }
        if (status != null && !STATUSES.contains(status))
            throw OpsInput.invalid("Situação inválida.");
        if (search != null && OpsInput.characters(search) > 200)
            throw OpsInput.invalid("Busca muito longa.");
        return exits.list(residentId, search, status).stream().map(e -> view(e, a)).toList();
    }

    @Transactional(readOnly = true)
    public LongExit get(UUID id) {
        LocalAccountPrincipal a = reader();
        return view(visible(id, a), a);
    }

    @Transactional
    public LongExit create(Plan input) {
        LocalAccountPrincipal a = actors.resident();
        lock(a.residentId());
        Instant now = now();
        Eligibility r = eligible(a.residentId(), now);
        Plan plan = plan(input, now);
        Guardian g = guardians.require(r.residentId(), plan.guardianId());
        noOverlap(r.residentId(), null, plan, now);
        UUID id = UUID.randomUUID(), documentId = UUID.randomUUID();
        Row created = exits.insert(id, r, g, plan, documentId, now);
        document(created, r, g, 1, now);
        binding(created, g, now);
        record(
                created,
                "CREATE",
                now,
                null,
                a,
                null,
                AuditAction.CREATE,
                Set.of(
                        "residentId",
                        "guardianId",
                        "departureMode",
                        "requestedDepartureAt",
                        "expectedReturnAt",
                        "reason",
                        "notes",
                        "status",
                        "documentVersionId"));
        return view(created, a);
    }

    @Transactional
    public LongExit update(UUID id, long version, Plan input) {
        LocalAccountPrincipal a = actors.resident();
        Row current = locked(id, a);
        version(current, version);
        status(current, LongExit.PENDING);
        Instant now = now();
        deadline(current, now);
        Eligibility r = eligible(current.residentId(), now);
        Plan p = plan(input, now);
        Guardian g = guardians.require(current.residentId(), p.guardianId());
        noOverlap(current.residentId(), id, p, now);
        int revision = exits.document(current.documentVersionId()).revision() + 1;
        Map<String, Object> changes = new HashMap<>();
        changes.put("guardian_id", g.id());
        changes.put("guardian_name", g.name());
        changes.put("guardian_relationship", g.relationship());
        changes.put("departure_mode", p.departureMode());
        changes.put("requested_departure_at", p.requestedDepartureAt());
        changes.put("expected_return_at", p.expectedReturnAt());
        changes.put("reason", p.reason());
        changes.put("notes", p.notes());
        changes.put("current_document_version_id", UUID.randomUUID());
        invalidate(current.id(), null, now);
        Row updated = changed(current, changes, now);
        document(updated, r, g, revision, now);
        binding(updated, g, now);
        Set<String> fields = new HashSet<>();
        fields.add("documentVersionId");
        if (!Objects.equals(current.guardianId(), updated.guardianId())) fields.add("guardianId");
        if (!Objects.equals(current.departureMode(), updated.departureMode()))
            fields.add("departureMode");
        if (!Objects.equals(current.requestedDepartureAt(), updated.requestedDepartureAt()))
            fields.add("requestedDepartureAt");
        if (!Objects.equals(current.expectedReturnAt(), updated.expectedReturnAt()))
            fields.add("expectedReturnAt");
        if (!Objects.equals(current.reason(), updated.reason())) fields.add("reason");
        if (!Objects.equals(current.notes(), updated.notes())) fields.add("notes");
        record(updated, "EDIT", now, null, a, null, AuditAction.UPDATE, Set.copyOf(fields));
        return view(updated, a);
    }

    @Transactional
    public LongExit decide(
            UUID id, long version, String decision, UUID documentVersionId, String comment) {
        LocalAccountPrincipal a = actors.supervisor();
        if (!Set.of("APPROVE", "REJECT").contains(decision))
            throw OpsInput.invalid("Decisão inválida.");
        if ("REJECT".equals(decision)) reason(comment);
        Row current = locked(id, a);
        version(current, version);
        status(current, LongExit.PENDING);
        Instant now = now();
        deadline(current, now);
        if ("APPROVE".equals(decision)) {
            if (documentVersionId == null)
                throw OpsInput.invalid("Informe a revisão documental aprovada.");
            if (!current.documentVersionId().equals(documentVersionId))
                throw conflict("stale_document", "A revisão documental foi alterada.");
            eligible(current.residentId(), now);
            BindingData valid =
                    integrations.current(current).stream()
                            .filter(
                                    b ->
                                            "VALID".equals(b.status())
                                                    && b.verifiedApi()
                                                    && b.revokedAt() == null
                                                    && b.verifiedAt() != null
                                                    && b.signedAt() != null
                                                    && b.signedAt().isBefore(b.expiresAt()))
                            .findFirst()
                            .orElseThrow(
                                    () ->
                                            conflict(
                                                    "signature_required",
                                                    "A aprovação exige assinatura confirmada para"
                                                            + " esta revisão."));
            Guardian g = guardians.require(current.residentId(), valid.guardianId());
            if (g.version() != valid.guardianVersion()
                    || !g.phone().equals(valid.guardianPhone())
                    || !g.name().equals(valid.guardianName())
                    || !g.relationship().equals(valid.guardianRelationship()))
                throw conflict(
                        "guardian_not_eligible",
                        "O cadastro do responsável mudou. Solicite uma nova assinatura.");
            DocumentRow doc = exits.document(current.documentVersionId());
            if (doc.signed() == null)
                throw conflict("document_unavailable", "O arquivo assinado não está confirmado.");
            verify(doc.original());
            verify(doc.signed());
        }
        Map<String, Object> changes = new HashMap<>();
        changes.put("status", "APPROVE".equals(decision) ? LongExit.APPROVED : "REJEITADA");
        changes.put("decision", decision);
        changes.put("decision_comment", comment);
        changes.put("decided_at", now);
        Row updated = changed(current, changes, now);
        if ("REJECT".equals(decision)) invalidate(id, null, now);
        record(
                updated,
                decision,
                now,
                null,
                a,
                comment,
                AuditAction.UPDATE,
                Objects.equals(current.decisionComment(), comment)
                        ? Set.of("status", "decision")
                        : Set.of("status", "decision", "decisionComment"));
        return view(updated, a);
    }

    @Transactional
    public LongExit cancel(UUID id, long version, String comment) {
        LocalAccountPrincipal a = reader();
        reason(comment);
        Row current = locked(id, a);
        version(current, version);
        Instant now = now();
        deadline(current, now);
        if (!LongExit.PENDING.equals(current.status())
                && !("supervisor".equals(a.profile())
                        && LongExit.APPROVED.equals(current.status())))
            throw conflict("invalid_state", "A solicitação não permite cancelamento.");
        Row updated =
                changed(
                        current,
                        Map.of("status", "CANCELADA", "cancellation_reason", comment),
                        now);
        invalidate(id, null, now);
        record(
                updated,
                "CANCEL",
                now,
                null,
                a,
                comment,
                AuditAction.END,
                Set.of("status", "cancellationReason"));
        return view(updated, a);
    }

    @Transactional
    public LongExit depart(UUID id, long version, PhysicalTime request) {
        LocalAccountPrincipal a = actors.supervisor();
        Row current = locked(id, a);
        version(current, version);
        status(current, LongExit.APPROVED);
        Instant now = now();
        deadline(current, now);
        eligible(current.residentId(), now);
        Instant departure = physical(request, now);
        if (departure.isBefore(current.requestedDepartureAt())
                || departure.isBefore(current.decidedAt())
                || !departure.isBefore(current.expectedReturnAt()))
            throw OpsInput.invalid(
                    "A partida física deve seguir a solicitação e a aprovação, antes do retorno"
                            + " previsto.");
        if (occupancies.stream().anyMatch(p -> p.physicalOpenFor(current.residentId())))
            throw conflict(
                    "physical_exit_conflict", "O residente possui outra saída em andamento.");
        Row updated =
                changed(
                        current,
                        Map.of("status", LongExit.IN_PROGRESS, "actual_departure_at", departure),
                        now);
        record(
                updated,
                "DEPARTURE",
                now,
                departure,
                a,
                request.justification(),
                AuditAction.UPDATE,
                Set.of("status", "actualDepartureAt"));
        return view(updated, a);
    }

    @Transactional
    public LongExit returnFromExit(
            UUID id, long version, PhysicalTime request, String lateObservation) {
        LocalAccountPrincipal a = actors.supervisor();
        Row current = locked(id, a);
        version(current, version);
        status(current, LongExit.IN_PROGRESS);
        Instant now = now(), returning = physical(request, now);
        if (!returning.isAfter(current.actualDepartureAt()))
            throw OpsInput.invalid("O retorno deve superar a partida física.");
        boolean late = returning.isAfter(current.expectedReturnAt());
        if (late) reason(lateObservation);
        Map<String, Object> changes = new HashMap<>();
        changes.put("status", late ? "RETORNO_CONFIRMADO_COM_ATRASO" : "RETORNO_CONFIRMADO");
        changes.put("actual_return_at", returning);
        changes.put("late_observation", lateObservation);
        Row updated = changed(current, changes, now);
        record(
                updated,
                "RETURN",
                now,
                returning,
                a,
                request.justification(),
                AuditAction.END,
                Objects.equals(current.lateObservation(), lateObservation)
                        ? Set.of("status", "actualReturnAt")
                        : Set.of("status", "actualReturnAt", "lateObservation"));
        evidenceSinks.forEach(sink -> sink.reconcile("LONG_RETURN", updated.id(), updated.residentId()));
        return view(updated, a);
    }

    @Transactional
    public LongExit resend(UUID id, long version, UUID guardianId, String comment) {
        LocalAccountPrincipal a = actors.supervisor();
        reason(comment);
        Row current = locked(id, a);
        version(current, version);
        status(current, LongExit.PENDING);
        Instant now = now();
        deadline(current, now);
        eligible(current.residentId(), now);
        if (!signature.available() || !whatsapp.available())
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "provider_unavailable",
                    "O reenvio exige provedores configurados.");
        if (integrations.current(current).stream()
                .anyMatch(b -> "VALID".equals(b.status()) && integrations.guardianCurrent(b)))
            throw conflict("signature_already_valid", "A revisão já possui assinatura válida.");
        if (integrations.recentResends(id, now) >= 3)
            throw conflict("resend_limit", "O limite é de três reenvios em 24 horas.");
        Instant last = integrations.lastResend(id);
        if (last != null && now.isBefore(last.plusSeconds(600)))
            throw conflict("resend_cooldown", "Aguarde dez minutos entre reenvios.");
        Guardian g =
                guardians.require(
                        current.residentId(),
                        guardianId == null ? current.guardianId() : guardianId);
        invalidate(id, null, now);
        Row updated;
        Set<String> fields;
        DocumentRow previous = exits.document(current.documentVersionId());
        if (!g.id().equals(current.guardianId())
                || !g.name().equals(current.guardianName())
                || !g.relationship().equals(current.guardianRelationship())
                || previous.signed() != null) {
            var old = json.readValue(previous.snapshot(), LongExitPdfGenerator.Snapshot.class);
            updated =
                    changed(
                            current,
                            Map.of(
                                    "guardian_id",
                                    g.id(),
                                    "guardian_name",
                                    g.name(),
                                    "guardian_relationship",
                                    g.relationship(),
                                    "current_document_version_id",
                                    UUID.randomUUID()),
                            now);
            var snapshot =
                    new LongExitPdfGenerator.Snapshot(
                            updated.documentVersionId(),
                            updated.id(),
                            previous.revision() + 1,
                            old.residentName(),
                            old.enrollment(),
                            old.birthDate(),
                            old.roomNumber(),
                            old.accommodationName(),
                            old.departure(),
                            old.expectedReturn(),
                            old.reason(),
                            old.notes(),
                            g.name(),
                            g.relationship());
            document(updated, snapshot, now);
            fields =
                    g.id().equals(current.guardianId())
                            ? Set.of("documentVersionId")
                            : Set.of("guardianId", "documentVersionId");
        } else {
            updated = changed(current, Map.of(), now);
            fields = Set.of();
        }
        BindingData created = binding(updated, g, now);
        integrations.resend(id, created.id(), a.id(), comment, now);
        record(updated, "RESEND", now, null, a, comment, AuditAction.UPDATE, fields);
        return view(updated, a);
    }

    @Transactional
    public LongExit reconcile(UUID id, long version) {
        LocalAccountPrincipal a = actors.supervisor();
        Row current = locked(id, a);
        version(current, version);
        status(current, LongExit.PENDING);
        Instant now = now();
        deadline(current, now);
        if (!signature.available())
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "provider_unavailable",
                    "O provedor de assinatura está indisponível.");
        BindingData b =
                integrations.current(current).stream()
                        .filter(
                                x ->
                                        x.revokedAt() == null
                                                && x.providerDocumentId() != null
                                                && "DONE".equals(x.stage()))
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        conflict(
                                                "invalid_state",
                                                "A assinatura ainda não está disponível para"
                                                        + " conferência."));
        enqueue(b.id(), "RECONCILE", "RECONCILE:" + b.id() + ":" + UUID.randomUUID(), now);
        Row updated = changed(current, Map.of(), now);
        record(updated, "RECONCILE_REQUEST", now, null, a, null, AuditAction.UPDATE, Set.of());
        return view(updated, a);
    }

    @Transactional(readOnly = true)
    public Download download(UUID id, UUID documentVersionId, boolean signed) {
        Row exit = visible(id, reader());
        DocumentRow doc = exits.document(documentVersionId);
        if (!doc.exitId().equals(exit.id())) throw OpsInput.notFound();
        StoredFile file = signed ? doc.signed() : doc.original();
        if (file == null) throw OpsInput.notFound();
        return new Download(
                verify(file),
                "autorizacao-"
                        + doc.id()
                        + "-r"
                        + doc.revision()
                        + (signed ? "-assinado" : "")
                        + ".pdf");
    }

    private void document(Row exit, Eligibility r, Guardian g, int revision, Instant now) {
        String accommodation =
                jdbc.queryForObject(
                        "SELECT name FROM sager_accommodation WHERE id=?",
                        String.class,
                        r.accommodationId());
        var snapshot =
                new LongExitPdfGenerator.Snapshot(
                        exit.documentVersionId(),
                        exit.id(),
                        revision,
                        r.residentName(),
                        r.enrollment(),
                        r.birthDate(),
                        r.roomNumber(),
                        accommodation,
                        exit.requestedDepartureAt(),
                        exit.expectedReturnAt(),
                        exit.reason(),
                        exit.notes(),
                        g.name(),
                        g.relationship());
        document(exit, snapshot, now);
    }

    private void document(Row exit, LongExitPdfGenerator.Snapshot snapshot, Instant now) {
        try {
            StoredFile file =
                    files.storeImmutable(
                            UUID.randomUUID(), new ByteArrayInputStream(pdf.generate(snapshot)));
            exits.insertDocument(
                    exit.documentVersionId(),
                    exit,
                    snapshot.revisionNumber(),
                    json.writeValueAsString(snapshot),
                    file,
                    now);
        } catch (PrivateFileException error) {
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "document_unavailable",
                    "Não foi possível armazenar o documento privado.");
        } catch (PdfGenerationException error) {
            throw OpsInput.invalid(
                    "O documento não aceita algum caractere informado. Revise os textos da"
                            + " solicitação e do cadastro.");
        }
        audit.record(
                AuditResource.DOCUMENT_VERSION,
                exit.documentVersionId(),
                AuditAction.CREATE,
                0,
                Set.of("exitId", "revisionNumber", "originalState", "originalHash"));
    }

    private BindingData binding(Row exit, Guardian g, Instant now) {
        Instant expiry = now.plusSeconds(86400);
        if (exit.deadline() != null && exit.deadline().isBefore(expiry)) expiry = exit.deadline();
        BindingData b =
                integrations.create(
                        exit, g, now, expiry, signature.environment(), signature.available());
        audit.record(
                AuditResource.SIGNATURE_BINDING,
                b.id(),
                AuditAction.CREATE,
                0,
                Set.of("exitId", "documentVersionId", "guardianId", "status", "expiresAt"));
        if (signature.available()) enqueue(b.id(), "PROVISION", "PROVISION:" + b.id(), now);
        return b;
    }

    private void invalidate(UUID exitId, UUID except, Instant now) {
        for (UUID id : integrations.invalidate(exitId, except, now)) {
            integrations.cancelPendingTasks(id, now);
            BindingData b = integrations.binding(id, false).orElseThrow();
            audit.record(
                    AuditResource.SIGNATURE_BINDING,
                    id,
                    AuditAction.END,
                    b.version(),
                    Set.of("status", "revokedAt"));
            if (b.envelopeId() != null && signature.available())
                enqueue(id, "CANCEL", "CANCEL:" + id, now);
        }
    }

    private void enqueue(UUID bindingId, String type, String key, Instant now) {
        UUID id = integrations.enqueue(bindingId, type, key, now);
        if (id != null)
            audit.record(
                    AuditResource.INTEGRATION_TASK,
                    id,
                    AuditAction.CREATE,
                    0,
                    Set.of("bindingId", "type", "state", "nextAttemptAt"));
    }

    private byte[] verify(StoredFile file) {
        try {
            return files.openVerified(file);
        } catch (PrivateFileException error) {
            throw conflict(
                    "document_unavailable",
                    "O arquivo privado está ausente ou não passou na verificação de integridade.");
        }
    }

    private LocalAccountPrincipal reader() {
        LocalAccountPrincipal a = actors.current();
        return "supervisor".equals(a.profile()) ? actors.supervisor() : actors.resident();
    }

    private Row visible(UUID id, LocalAccountPrincipal a) {
        Row e = exits.find(id, false).orElseThrow(OpsInput::notFound);
        if ("residente".equals(a.profile()) && !e.residentId().equals(a.residentId()))
            throw OpsInput.notFound();
        return e;
    }

    private Row locked(UUID id, LocalAccountPrincipal a) {
        Row e = visible(id, a);
        lock(e.residentId());
        return exits.find(id, true).orElseThrow(OpsInput::notFound);
    }

    private void lock(UUID residentId) {
        if (!residents.lock(residentId)) throw OpsInput.notFound();
    }

    private Eligibility eligible(UUID id, Instant now) {
        Eligibility r = residents.eligibility(id, now);
        if (!r.eligible())
            throw conflict(
                    "not_eligible",
                    "A saída exige menor de idade com nascimento e alocação ativa.");
        return r;
    }

    private Plan plan(Plan p, Instant now) {
        if (p == null
                || p.departureMode() == null
                || !Set.of("NOW", "SCHEDULED").contains(p.departureMode()))
            throw OpsInput.invalid("Informe NOW ou SCHEDULED.");
        Instant departure = normalize(p.requestedDepartureAt());
        if ("NOW".equals(p.departureMode())) {
            if (departure != null) throw OpsInput.invalid("NOW usa somente o relógio do servidor.");
            departure = now;
        } else if (departure == null || !departure.isAfter(now))
            throw OpsInput.invalid(
                    "A partida agendada deve ser futura para permitir a assinatura.");
        Instant returning = normalize(p.expectedReturnAt());
        if (returning == null
                || Duration.between(departure, returning).compareTo(Duration.ofHours(3)) <= 0)
            throw OpsInput.invalid("A saída longa exige duração maior que três horas.");
        if (p.reason() == null
                || OpsInput.characters(p.reason().trim()) < 3
                || OpsInput.characters(p.reason()) > 2000)
            throw OpsInput.invalid("Informe motivo de 3 a 2000 caracteres.");
        if (p.notes() != null && OpsInput.characters(p.notes()) > 2000)
            throw OpsInput.invalid("Observação muito longa.");
        if (p.guardianId() == null) throw OpsInput.invalid("Selecione o responsável cadastrado.");
        return new Plan(
                p.departureMode(), departure, returning, p.reason(), p.notes(), p.guardianId());
    }

    private void noOverlap(UUID residentId, UUID excluded, Plan p, Instant now) {
        var ref = excluded == null ? null : new AuthorizedExitLookup.Reference(excluded, "LONG");
        if (occupancies.stream()
                .anyMatch(
                        x ->
                                x.overlaps(
                                        residentId,
                                        ref,
                                        p.requestedDepartureAt(),
                                        p.expectedReturnAt(),
                                        now)))
            throw conflict("overlapping_exit", "Outra solicitação ativa ocupa esse intervalo.");
    }

    private Instant physical(PhysicalTime p, Instant now) {
        if (p == null || p.timeMode() == null) throw OpsInput.invalid("Informe o modo de horário.");
        if ("NOW".equals(p.timeMode())) {
            if (p.occurredAt() != null || p.justification() != null)
                throw OpsInput.invalid("NOW usa somente o relógio do servidor.");
            return now;
        }
        if (!"RETROACTIVE".equals(p.timeMode()))
            throw OpsInput.invalid("Modo de horário inválido.");
        reason(p.justification());
        Instant at = normalize(p.occurredAt());
        if (at == null || at.isAfter(now))
            throw OpsInput.invalid("O horário retroativo não pode ser futuro.");
        return at;
    }

    private void version(Row e, long v) {
        if (v < 0 || v == Long.MAX_VALUE) throw OpsInput.invalid("Versão inválida.");
        if (e.version() != v)
            throw conflict("stale_version", "A solicitação foi alterada. Recarregue o registro.");
    }

    private void status(Row e, String s) {
        if (!s.equals(e.status()))
            throw conflict("invalid_state", "A situação não permite essa ação.");
    }

    private void deadline(Row e, Instant now) {
        if (e.deadline() != null && !now.isBefore(e.deadline()))
            throw conflict("deadline_passed", "O prazo desta solicitação encerrou.");
    }

    private void reason(String s) {
        if (s == null || OpsInput.characters(s.trim()) < 10 || OpsInput.characters(s) > 2000)
            throw OpsInput.invalid("Informe justificativa de 10 a 2000 caracteres.");
    }

    private Row changed(Row e, Map<String, Object> changes, Instant now) {
        Row updated = exits.update(e, changes, now);
        if (updated == null) throw conflict("stale_version", "A solicitação foi alterada.");
        return updated;
    }

    private void record(
            Row e,
            String event,
            Instant now,
            Instant effective,
            LocalAccountPrincipal a,
            String reason,
            AuditAction action,
            Set<String> fields) {
        exits.history(e, event, now, effective, a.id(), a.profile(), "LOCAL_API", reason);
        audit.record(AuditResource.LONG_EXIT, e.id(), action, e.version(), fields);
    }

    private LongExit view(Row e, LocalAccountPrincipal a) {
        Instant now = now(), deadline = e.deadline();
        boolean live = deadline == null || now.isBefore(deadline),
                sup = "supervisor".equals(a.profile()),
                pending = LongExit.PENDING.equals(e.status()),
                approved = LongExit.APPROVED.equals(e.status());
        DocumentRow doc = exits.document(e.documentVersionId());
        List<LongExit.Binding> bindings = integrations.views(e.id(), whatsapp.available(), now);
        List<LongExit.Binding> current =
                bindings.stream().filter(b -> b.documentVersionId().equals(doc.id())).toList();
        LongExit.Binding b =
                current.stream()
                        .filter(x -> "VALID".equals(x.status()))
                        .findFirst()
                        .orElse(current.isEmpty() ? null : current.getFirst());
        String signatureStatus = b == null ? "UNAVAILABLE" : b.status(),
                messageStatus = b == null ? "UNAVAILABLE" : b.messageStatus();
        int remaining = Math.max(0, 3 - integrations.recentResends(e.id(), now));
        Instant last = integrations.lastResend(e.id());
        Instant available = last == null ? null : last.plusSeconds(600);
        if (remaining == 0)
            available = integrations.oldestRecentResend(e.id(), now).plusSeconds(86400);
        boolean valid = "VALID".equals(signatureStatus) && doc.signed() != null;
        var caps =
                new LongExit.Capabilities(
                        !sup && pending && live,
                        sup && pending && live && valid,
                        sup && pending && live,
                        live && (pending || sup && approved),
                        sup && approved && live && !now.isBefore(e.requestedDepartureAt()),
                        sup && LongExit.IN_PROGRESS.equals(e.status()),
                        sup
                                && pending
                                && live
                                && !valid
                                && signature.available()
                                && whatsapp.available()
                                && remaining > 0
                                && (available == null || !now.isBefore(available)),
                        sup
                                && pending
                                && live
                                && signature.available()
                                && integrations.current(e).stream()
                                        .anyMatch(
                                                x ->
                                                        x.revokedAt() == null
                                                                && x.providerDocumentId() != null
                                                                && "DONE".equals(x.stage())),
                        true,
                        doc.signed() != null);
        List<LongExit.History> history = exits.history(e.id());
        Instant recordedDeparture =
                history.stream()
                        .filter(h -> "DEPARTURE".equals(h.event()))
                        .map(LongExit.History::recordedAt)
                        .findFirst()
                        .orElse(null);
        Instant recordedReturn =
                history.stream()
                        .filter(h -> "RETURN".equals(h.event()))
                        .map(LongExit.History::recordedAt)
                        .findFirst()
                        .orElse(null);
        return new LongExit(
                e.id(),
                e.residentId(),
                e.residentName(),
                e.enrollment(),
                e.guardianId(),
                e.guardianName(),
                e.guardianRelationship(),
                e.departureMode(),
                e.requestedDepartureAt(),
                e.expectedReturnAt(),
                e.reason(),
                e.notes(),
                e.status(),
                e.decision(),
                e.decisionComment(),
                e.decidedAt(),
                e.actualDepartureAt(),
                e.actualReturnAt(),
                e.lateObservation(),
                e.cancellationReason(),
                e.expiryReason(),
                e.createdAt(),
                e.updatedAt(),
                e.version(),
                recordedDeparture,
                recordedReturn,
                deadline,
                deadline != null && !live,
                now,
                OperationResidents.ZONE.getId(),
                new LongExit.Document(
                        doc.id(),
                        doc.revision(),
                        doc.original().state(),
                        doc.signed() == null ? "MISSING" : doc.signed().state()),
                signatureStatus,
                messageStatus,
                b == null ? null : b.signedAt(),
                available,
                remaining,
                caps,
                bindings,
                history);
    }

    private Instant now() {
        return normalize(clock.instant());
    }

    private Instant normalize(Instant at) {
        return at == null ? null : at.truncatedTo(ChronoUnit.MICROS);
    }

    private LongExitApiException conflict(String code, String message) {
        return new LongExitApiException(HttpStatus.CONFLICT, code, message);
    }

    public record Plan(
            String departureMode,
            Instant requestedDepartureAt,
            Instant expectedReturnAt,
            String reason,
            String notes,
            UUID guardianId) {}

    public record PhysicalTime(String timeMode, Instant occurredAt, String justification) {}

    public record Download(byte[] bytes, String filename) {}

    public record Providers(boolean clicksignEnabled, boolean whatsappEnabled) {}

    public record LongEligibility(
            UUID residentId,
            String residentName,
            String enrollment,
            java.time.LocalDate birthDate,
            UUID roomId,
            String roomNumber,
            UUID accommodationId,
            boolean eligible,
            List<String> blockers,
            java.time.LocalDate currentDate,
            Instant now,
            String zone,
            List<Guardian> guardians,
            Providers providers) {}
}
