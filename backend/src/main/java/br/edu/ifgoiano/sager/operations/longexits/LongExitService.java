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
import br.edu.ifgoiano.sager.integrations.AuthorizationFileType;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository.AuthorizationFile;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository.BindingData;
import br.edu.ifgoiano.sager.integrations.WhatsAppGateway;
import br.edu.ifgoiano.sager.management.guardians.BrazilianPhone;
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
    private static final Duration DELIVERY_ALERT = Duration.ofMinutes(15);
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
    private final WhatsAppGateway whatsapp;
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
            WhatsAppGateway whatsapp,
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
                new Providers(whatsapp.available()));
    }

    @Transactional(readOnly = true)
    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<LongExit> list(java.util.Map<String,String> input) {
        LocalAccountPrincipal a = reader();
        var filters=new java.util.HashMap<>(input);
        String requested=filters.get("residentId");
        if ("residente".equals(a.profile())) {
            if (requested != null && !requested.isBlank() && !requested.equals(a.residentId().toString())) throw OpsInput.notFound();
            filters.put("residentId",a.residentId().toString());
        }
        String status=filters.get("status");
        if (status != null && !status.isBlank() && !STATUSES.contains(status)) throw OpsInput.invalid("Situação inválida.");
        var page=exits.search(filters);
        return new br.edu.ifgoiano.sager.management.ManagementSearch.Page<>(page.items().stream().map(exit->view(exit,a)).toList(),page.total());
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
        binding(created, g, now, integrations.nextResidentSend(created.residentId(), now));
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
        binding(updated, g, now, integrations.nextResidentSend(updated.residentId(), now));
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
                                                    && b.verifiedBy() != null
                                                    && b.revokedAt() == null
                                                    && b.verifiedAt() != null
                                                    && b.signedAt() != null
                                                    && b.signedAt().isBefore(b.expiresAt()))
                            .findFirst()
                            .orElseThrow(
                                    () ->
                                            conflict(
                                                    "signature_required",
                                                    "A aprovação exige autorização conferida para"
                                                            + " esta revisão."));
            Guardian g = guardians.require(current.residentId(), valid.guardianId());
            if (g.version() != valid.guardianVersion()
                    || !g.phone().equals(valid.guardianPhone())
                    || !g.name().equals(valid.guardianName())
                    || !g.relationship().equals(valid.guardianRelationship()))
                throw conflict(
                        "guardian_not_eligible",
                        "O cadastro do responsável mudou. Solicite uma nova autorização.");
            DocumentRow doc = exits.document(current.documentVersionId());
            if (doc.signed() == null)
                throw conflict("document_unavailable", "O arquivo da autorização não está confirmado.");
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
        if (!whatsapp.available())
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "provider_unavailable",
                    "O reenvio exige o WhatsApp configurado.");
        if (integrations.current(current).stream()
                .anyMatch(b -> "VALID".equals(b.status()) && integrations.guardianCurrent(b)))
            throw conflict("signature_already_valid", "A revisão já possui autorização conferida.");
        // The resend revokes the current link: a file still waiting would become impossible to check.
        if (integrations.authorizationFiles(id).stream().anyMatch(f -> waiting(f, current)))
            throw conflict(
                    "authorization_pending",
                    "Confira ou recuse o arquivo recebido antes de reenviar o documento.");
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
        if (needsNewRevision(current, g, previous)) {
            updated = newRevision(current, g, previous, now);
            fields =
                    g.id().equals(current.guardianId())
                            ? Set.of("documentVersionId")
                            : Set.of("guardianId", "documentVersionId");
        } else {
            updated = changed(current, Map.of(), now);
            fields = Set.of();
        }
        BindingData created = binding(updated, g, now, now);
        integrations.resend(id, created.id(), a.id(), comment, now);
        record(updated, "RESEND", now, null, a, comment, AuditAction.UPDATE, fields);
        return view(updated, a);
    }

    /** Records the human check of one received file; approving the request stays a separate act. */
    @Transactional
    public LongExit confirmAuthorization(
            UUID id, UUID fileId, long version, boolean confirmed, String justification) {
        LocalAccountPrincipal a = actors.supervisor();
        if (!confirmed)
            throw OpsInput.invalid("Declare ter conferido responsável, documento e revisão.");
        Row current = lockedPending(id, version, a);
        Instant now = now();
        eligible(current.residentId(), now);
        AuthorizationFile file = candidate(current, fileId);
        if (!file.documentVersionId().equals(current.documentVersionId()))
            throw conflict("stale_document", "O arquivo pertence a outra revisão do documento.");
        BindingData binding = integrations.binding(file.bindingId(), true).orElseThrow();
        if (binding.revokedAt() != null)
            throw conflict("stale_document", "O arquivo pertence a um envio já substituído.");
        Guardian g = guardians.require(current.residentId(), binding.guardianId());
        if (g.version() != binding.guardianVersion()
                || !g.phone().equals(binding.guardianPhone())
                || !g.name().equals(binding.guardianName())
                || !g.relationship().equals(binding.guardianRelationship()))
            throw conflict(
                    "guardian_not_eligible",
                    "O cadastro do responsável mudou. Solicite uma nova autorização.");
        if (divergent(file) || justification != null) reason(justification);
        verify(file.file());
        if (!integrations.promote(file))
            throw conflict("invalid_state", "Esta revisão já possui arquivo confirmado.");
        integrations.decideAuthorizationFile(file, "ACCEPTED", a.id(), justification, now);
        integrations.verify(binding, file, a.id(), now);
        invalidate(id, binding.id(), now);
        audit.record(
                AuditResource.DOCUMENT_VERSION,
                file.documentVersionId(),
                AuditAction.UPDATE,
                1,
                Set.of("signedState", "signedHash", "signedMediaType"));
        audit.record(
                AuditResource.SIGNATURE_BINDING,
                binding.id(),
                AuditAction.UPDATE,
                binding.version() + 1,
                Set.of("status", "signedAt", "verifiedAt", "verifiedBy", "evidenceHash"));
        audit.record(
                AuditResource.AUTHORIZATION_FILE,
                file.id(),
                AuditAction.UPDATE,
                file.version() + 1,
                justification == null
                        ? Set.of("state", "decidedBy", "decidedAt")
                        : Set.of("state", "decidedBy", "decidedAt", "decisionReason"));
        Row updated = changed(current, Map.of(), now);
        record(
                updated,
                "AUTHORIZATION_CONFIRMED",
                now,
                file.receivedAt(),
                a,
                justification,
                AuditAction.UPDATE,
                Set.of());
        return view(updated, a);
    }

    @Transactional
    public LongExit refuseAuthorization(UUID id, UUID fileId, long version, String comment) {
        LocalAccountPrincipal a = actors.supervisor();
        reason(comment);
        Row current = lockedPending(id, version, a);
        Instant now = now();
        AuthorizationFile file = candidate(current, fileId);
        integrations.decideAuthorizationFile(file, "REFUSED", a.id(), comment, now);
        audit.record(
                AuditResource.AUTHORIZATION_FILE,
                file.id(),
                AuditAction.UPDATE,
                file.version() + 1,
                Set.of("state", "decidedBy", "decidedAt", "decisionReason"));
        Row updated = changed(current, Map.of(), now);
        record(
                updated,
                "AUTHORIZATION_REFUSED",
                now,
                null,
                a,
                comment,
                AuditAction.UPDATE,
                Set.of());
        return view(updated, a);
    }

    /** Works with the gateway on or off: the operation never depends only on WhatsApp. */
    @Transactional
    public LongExit attachAuthorization(UUID id, long version, byte[] bytes) {
        LocalAccountPrincipal a = actors.supervisor();
        Row locked = lockedPending(id, version, a);
        Instant now = now();
        eligible(locked.residentId(), now);
        String type = AuthorizationFileType.detect(bytes);
        if (type == null) throw OpsInput.invalid("Anexe uma imagem ou um PDF.");
        Row current = withCurrentGuardian(locked, a, now);
        BindingData binding = openBinding(current, now);
        StoredFile file;
        try {
            file = files.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(bytes));
        } catch (PrivateFileException error) {
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "document_unavailable",
                    "Não foi possível armazenar o arquivo privado.");
        }
        return linked(current, a, binding, null, "MANUAL", file, type, null, now, now);
    }

    @Transactional
    public LongExit linkAuthorization(UUID id, long version, UUID messageId) {
        LocalAccountPrincipal a = actors.supervisor();
        Row locked = lockedPending(id, version, a);
        Instant now = now();
        eligible(locked.residentId(), now);
        var message = integrations.storedMessage(messageId).orElseThrow(OpsInput::notFound);
        Row current = withCurrentGuardian(locked, a, now);
        BindingData binding = openBinding(current, now);
        // A resend keeps the revision, so an answer to its first send still refers to this document.
        if (message.receivedAt().isBefore(integrations.current(current).getLast().createdAt()))
            throw conflict("stale_document", "O arquivo é anterior a este documento.");
        return linked(
                current,
                a,
                binding,
                message.id(),
                "WHATSAPP",
                message.file(),
                message.mediaType(),
                message.senderPhone(),
                message.receivedAt(),
                now);
    }

    @Transactional(readOnly = true)
    public List<ReceivedFile> unlinkedFiles(UUID id) {
        LocalAccountPrincipal a = actors.supervisor();
        Row exit = visible(id, a);
        return integrations.unlinkedMessages(exit.createdAt()).stream()
                .map(
                        m ->
                                new ReceivedFile(
                                        m.id(),
                                        m.senderPhone(),
                                        BrazilianPhone.same(
                                                m.senderPhone(),
                                                guardianPhone(exit)),
                                        m.mediaState(),
                                        m.mediaFailureCode(),
                                        m.mediaType(),
                                        m.file() == null ? 0 : m.file().size(),
                                        m.receivedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Download authorizationFile(UUID id, UUID fileId) {
        LocalAccountPrincipal a = actors.supervisor();
        Row exit = visible(id, a);
        AuthorizationFile file =
                integrations
                        .authorizationFile(fileId, false)
                        .filter(f -> f.exitId().equals(exit.id()))
                        .orElseThrow(OpsInput::notFound);
        return new Download(
                verify(file.file()),
                "autorizacao-recebida-"
                        + file.id()
                        + "."
                        + AuthorizationFileType.extension(file.mediaType()),
                file.mediaType());
    }

    @Transactional(readOnly = true)
    public Download download(UUID id, UUID documentVersionId, boolean signed) {
        Row exit = visible(id, reader());
        DocumentRow doc = exits.document(documentVersionId);
        if (!doc.exitId().equals(exit.id())) throw OpsInput.notFound();
        StoredFile file = signed ? doc.signed() : doc.original();
        if (file == null) throw OpsInput.notFound();
        String type = signed && doc.signedMediaType() != null ? doc.signedMediaType() : "application/pdf";
        return new Download(
                verify(file),
                "autorizacao-"
                        + doc.id()
                        + "-r"
                        + doc.revision()
                        + (signed ? "-assinado" : "")
                        + "."
                        + AuthorizationFileType.extension(type),
                type);
    }

    private void document(Row exit, Eligibility r, Guardian g, int revision, Instant now) {
        var snapshot =
                new LongExitPdfGenerator.Snapshot(
                        exit.documentVersionId(),
                        exit.id(),
                        revision,
                        r.residentName(),
                        exit.requestedDepartureAt(),
                        exit.expectedReturnAt(),
                        exit.reason(),
                        g.name());
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

    private BindingData binding(Row exit, Guardian g, Instant now, Instant sendAt) {
        BindingData b = anchor(exit, g, now, whatsapp.available());
        if (whatsapp.available()) enqueue(b.id(), "WHATSAPP", "WHATSAPP:" + b.id(), now, sendAt);
        return b;
    }

    private BindingData anchor(Row exit, Guardian g, Instant now, boolean sending) {
        BindingData b = integrations.create(exit, g, now, sending);
        audit.record(
                AuditResource.SIGNATURE_BINDING,
                b.id(),
                AuditAction.CREATE,
                0,
                Set.of("exitId", "documentVersionId", "guardianId", "status", "expiresAt"));
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
        }
    }

    private void enqueue(UUID bindingId, String type, String key, Instant now, Instant sendAt) {
        UUID id = integrations.enqueue(bindingId, type, key, now, sendAt);
        if (id != null)
            audit.record(
                    AuditResource.INTEGRATION_TASK,
                    id,
                    AuditAction.CREATE,
                    0,
                    Set.of("bindingId", "type", "state", "nextAttemptAt"));
    }

    private Row lockedPending(UUID id, long version, LocalAccountPrincipal a) {
        Row current = locked(id, a);
        version(current, version);
        status(current, LongExit.PENDING);
        deadline(current, now());
        return current;
    }

    private AuthorizationFile candidate(Row exit, UUID fileId) {
        AuthorizationFile file =
                integrations
                        .authorizationFile(fileId, true)
                        .filter(f -> f.exitId().equals(exit.id()))
                        .orElseThrow(OpsInput::notFound);
        if (!"CANDIDATE".equals(file.state()))
            throw conflict("invalid_state", "O arquivo já foi conferido ou recusado.");
        return file;
    }

    private static boolean waiting(AuthorizationFile file, Row exit) {
        return "CANDIDATE".equals(file.state())
                && file.documentVersionId().equals(exit.documentVersionId());
    }

    private boolean needsNewRevision(Row exit, Guardian g, DocumentRow document) {
        return !g.id().equals(exit.guardianId())
                || !g.name().equals(exit.guardianName())
                || !g.relationship().equals(exit.guardianRelationship())
                || document.signed() != null;
    }

    private Row newRevision(Row exit, Guardian g, DocumentRow previous, Instant now) {
        var old = json.readValue(previous.snapshot(), LongExitPdfGenerator.Snapshot.class);
        Row updated =
                changed(
                        exit,
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
                        old.departure(),
                        old.expectedReturn(),
                        old.reason(),
                        g.name());
        document(updated, snapshot, now);
        return updated;
    }

    /**
     * With the gateway off only this path can follow a corrected guardian record, since a resend
     * needs WhatsApp. An already checked file holds the old revision, so it needs a new one.
     */
    private Row withCurrentGuardian(Row exit, LocalAccountPrincipal a, Instant now) {
        List<BindingData> open =
                integrations.current(exit).stream().filter(b -> b.revokedAt() == null).toList();
        if (open.isEmpty() || open.stream().anyMatch(integrations::guardianCurrent)) return exit;
        Guardian g = guardians.require(exit.residentId(), exit.guardianId());
        invalidate(exit.id(), null, now);
        DocumentRow document = exits.document(exit.documentVersionId());
        if (!needsNewRevision(exit, g, document)) return exit;
        Row updated = newRevision(exit, g, document, now);
        record(
                updated,
                "GUARDIAN_CHANGED",
                now,
                null,
                a,
                null,
                AuditAction.UPDATE,
                Set.of("documentVersionId"));
        return updated;
    }

    /** Requests from before V23 may need a new anchor, which must not message the guardian. */
    private BindingData openBinding(Row exit, Instant now) {
        List<BindingData> bindings = integrations.current(exit);
        if (bindings.stream().anyMatch(b -> "VALID".equals(b.status()) && b.revokedAt() == null))
            throw conflict("signature_already_valid", "A revisão já possui autorização conferida.");
        return bindings.stream()
                .filter(b -> b.revokedAt() == null)
                .findFirst()
                .orElseGet(
                        () ->
                                anchor(
                                        exit,
                                        guardians.require(exit.residentId(), exit.guardianId()),
                                        now,
                                        false));
    }

    private LongExit linked(
            Row current,
            LocalAccountPrincipal a,
            BindingData binding,
            UUID messageId,
            String origin,
            StoredFile file,
            String type,
            String sender,
            Instant receivedAt,
            Instant now) {
        UUID created =
                integrations.insertAuthorizationFile(
                        binding, messageId, origin, file, type, sender, receivedAt, now);
        if (created == null) throw conflict("already_linked", "O arquivo já está vinculado.");
        audit.record(
                AuditResource.AUTHORIZATION_FILE,
                created,
                AuditAction.CREATE,
                0,
                Set.of(
                        "exitId",
                        "documentVersionId",
                        "bindingId",
                        "origin",
                        "state",
                        "fileHash",
                        "mediaType"));
        Row updated = changed(current, Map.of(), now);
        record(
                updated,
                "AUTHORIZATION_LINKED",
                now,
                receivedAt,
                a,
                null,
                AuditAction.UPDATE,
                Set.of());
        return view(updated, a);
    }

    private static boolean divergent(AuthorizationFile file) {
        return "WHATSAPP".equals(file.origin())
                && !BrazilianPhone.same(file.senderPhone(), file.guardianPhone());
    }

    private String guardianPhone(Row exit) {
        return integrations.current(exit).stream()
                .map(BindingData::guardianPhone)
                .findFirst()
                .orElse(null);
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
        List<LongExit.Binding> bindings = integrations.views(e.id(), whatsapp.available(), now, sup);
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
        List<AuthorizationFile> files = sup ? integrations.authorizationFiles(e.id()) : List.of();
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
                                && whatsapp.available()
                                && files.stream().noneMatch(f -> waiting(f, e))
                                && remaining > 0
                                && (available == null || !now.isBefore(available)),
                        sup && pending && live && !valid,
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
                files.stream().map(this::fileView).toList(),
                whatsapp.available(),
                sup
                        && pending
                        && !valid
                        && whatsapp.available()
                        && b != null
                        && b.revokedAt() == null
                        && !Set.of("DELIVERED", "READ").contains(messageStatus)
                        && !now.isBefore(b.createdAt().plus(DELIVERY_ALERT)),
                history);
    }

    private LongExit.AuthorizationFile fileView(AuthorizationFile f) {
        return new LongExit.AuthorizationFile(
                f.id(),
                f.documentVersionId(),
                f.bindingId(),
                f.origin(),
                f.state(),
                f.mediaType(),
                f.file().size(),
                f.file().sha256(),
                f.senderPhone(),
                divergent(f),
                f.receivedAt(),
                f.decidedBy(),
                integrations.accountName(f.decidedBy()),
                f.decidedAt(),
                f.decisionReason());
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

    public record Download(byte[] bytes, String filename, String mediaType) {}

    public record ReceivedFile(
            UUID messageId,
            String senderPhone,
            boolean fromGuardian,
            String mediaState,
            String failureCode,
            String mediaType,
            long size,
            Instant receivedAt) {}

    public record Providers(boolean whatsappEnabled) {}

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
