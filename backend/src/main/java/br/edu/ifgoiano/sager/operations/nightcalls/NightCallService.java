package br.edu.ifgoiano.sager.operations.nightcalls;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import br.edu.ifgoiano.sager.management.FieldRules;
import br.edu.ifgoiano.sager.operations.AuthorizedExitLookup;
import br.edu.ifgoiano.sager.operations.OperationResidents;
import br.edu.ifgoiano.sager.operations.OccurrenceEvidenceSink;
import br.edu.ifgoiano.sager.operations.OpsActor;
import br.edu.ifgoiano.sager.operations.OpsApiException;
import br.edu.ifgoiano.sager.operations.OpsInput;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
public class NightCallService {
    private static final LocalTime WINDOW_START = LocalTime.of(22, 0);
    private static final LocalTime WINDOW_END = LocalTime.of(23, 30);
    private static final Set<String> MARKS = Set.of("PRESENTE", "AUSENTE", "AUSENCIA_JUSTIFICADA");
    private final NightCallRepository calls;
    private final OpsActor actors;
    private final AuditService audit;
    private final Clock clock;
    private final List<AuthorizedExitLookup> exitLookups;
    private final List<OccurrenceEvidenceSink> evidenceSinks;

    public NightCallService(NightCallRepository calls, OpsActor actors, AuditService audit,
            Clock clock, List<AuthorizedExitLookup> exitLookups, List<OccurrenceEvidenceSink> evidenceSinks) {
        this.calls = calls;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.exitLookups = List.copyOf(exitLookups);
        this.evidenceSinks = List.copyOf(evidenceSinks);
    }

    @Transactional(readOnly = true)
    public NightCall.Context context(UUID accommodationId) {
        actors.supervisor();
        Instant now = now();
        LocalDate today = today(now);
        List<NightCall.AccommodationOption> accommodations = calls.accommodations(today);
        List<NightCall.MissingBirthDate> missing = new ArrayList<>();
        int minors = 0;
        UUID existing = null;
        if (accommodationId != null) {
            accommodation(accommodationId, accommodations);
            for (NightCallRepository.RosterResident resident : calls.roster(accommodationId, now)) {
                if (resident.birthDate() == null) missing.add(new NightCall.MissingBirthDate(resident.id(),
                        resident.name(), resident.enrollment(), resident.roomNumber()));
                else if (FieldRules.minor(resident.birthDate(), today)) minors++;
            }
            existing = calls.existing(accommodationId, today);
        }
        return new NightCall.Context(accommodationId, today, now, OperationResidents.ZONE.getId(),
                WINDOW_START, WINDOW_END, outsideWindow(now), existing, minors, accommodations, List.copyOf(missing));
    }

    @Transactional(readOnly = true)
    public List<NightCall> list(UUID accommodationId, LocalDate date) {
        actors.supervisor();
        return calls.list(accommodationId, date).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public NightCall get(UUID id) {
        actors.supervisor();
        return view(calls.find(id, false).orElseThrow(OpsInput::notFound));
    }

    @Transactional
    public NightCall open(UUID accommodationId, boolean confirmed, String justification) {
        LocalAccountPrincipal actor = actors.supervisor();
        if (accommodationId == null) throw OpsInput.invalid("Informe o alojamento.");
        Instant now = now();
        LocalDate today = today(now);
        boolean exceptional = outsideWindow(now);
        String reason = exceptionReason(exceptional, confirmed, justification);
        NightCall.AccommodationOption accommodation = accommodation(accommodationId, calls.accommodations(today));
        if (calls.existing(accommodationId, today) != null) throw exists();
        List<NightCallRepository.RosterResident> all = calls.roster(accommodationId, now);
        if (all.stream().anyMatch(resident -> resident.birthDate() == null)) {
            throw OpsInput.conflict("birth_date_required", "Informe o nascimento de todos os residentes alocados antes de abrir a chamada.");
        }
        NightCall created;
        try {
            created = calls.insert(UUID.randomUUID(), accommodation, today, now, actor.id(), exceptional, reason);
        } catch (DuplicateKeyException error) {
            throw exists();
        }
        audit.record(AuditResource.NIGHT_CALL, created.id(), AuditAction.CREATE, 0,
                exceptional ? Set.of("accommodationId", "referenceDate", "status", "outsideWindowConfirmed", "justification")
                        : Set.of("accommodationId", "referenceDate", "status"));
        for (NightCallRepository.RosterResident resident : all) {
            if (!FieldRules.minor(resident.birthDate(), today)) continue;
            NightCall.ResidentMark mark = calls.insertMark(created.id(), resident);
            audit.record(AuditResource.NIGHT_CALL_MARK, mark.id(), AuditAction.CREATE, 0,
                    Set.of("callId", "residentId"));
            List<AuthorizedExitLookup.Reference> exits = authorized(resident.id(), now);
            if (exits.size() == 1) { // com mais de uma, o supervisor escolhe a saída
                NightCall.ResidentMark justified = calls.updateMark(mark.id(), "AUSENCIA_JUSTIFICADA", exits.getFirst());
                calls.history(justified, 0, null, now, actor.id(), "sistema");
                audit.record(AuditResource.NIGHT_CALL_MARK, justified.id(), AuditAction.UPDATE, justified.version(),
                        Set.of("mark", "authorizedExitId", "authorizedExitType"));
            }
        }
        return view(created);
    }

    @Transactional
    public NightCall mark(UUID id, UUID residentId, long version, String mark,
            UUID authorizedExitId, String authorizedExitType, String justification, boolean correction) {
        LocalAccountPrincipal actor = actors.supervisor();
        if (mark == null || !MARKS.contains(mark)) throw OpsInput.invalid("Marcação inválida.");
        if (correction) reason(justification);
        NightCall current = locked(id, version);
        if (!(correction ? "FECHADA" : "ABERTA").equals(current.status())) {
            throw OpsInput.conflict("invalid_state", correction ? "Correções exigem uma chamada fechada."
                    : "A chamada fechada exige uma correção justificada.");
        }
        NightCall.ResidentMark previous = calls.mark(id, residentId).orElseThrow(OpsInput::notFound);
        AuthorizedExitLookup.Reference exit = authorization(current, residentId, mark, authorizedExitId, authorizedExitType);
        NightCall.ResidentMark changed = calls.updateMark(previous.id(), mark, exit);
        long callVersion = calls.advanceVersion(id, version);
        calls.history(changed, callVersion, correction ? justification : null, now(), actor.id(), actor.profile());
        Set<String> fields = new HashSet<>();
        if (!Objects.equals(previous.mark(), changed.mark())) fields.add("mark");
        if (!Objects.equals(previous.authorizedExitId(), changed.authorizedExitId())) fields.add("authorizedExitId");
        if (!Objects.equals(previous.authorizedExitType(), changed.authorizedExitType())) fields.add("authorizedExitType");
        if (correction) fields.add("justification");
        audit.record(AuditResource.NIGHT_CALL_MARK, changed.id(), AuditAction.UPDATE, changed.version(), Set.copyOf(fields));
        if (correction) {
            evidenceSinks.forEach(sink -> sink.reconcile("NIGHT_CALL", changed.id(), changed.residentId()));
        }
        return view(calls.find(id, false).orElseThrow(OpsInput::notFound));
    }

    @Transactional
    public NightCall close(UUID id, long version, boolean confirmed, String justification) {
        LocalAccountPrincipal actor = actors.supervisor();
        NightCall current = locked(id, version);
        if (!"ABERTA".equals(current.status())) throw OpsInput.conflict("invalid_state", "A chamada já está fechada.");
        if (calls.marks(id).stream().anyMatch(mark -> mark.mark() == null)) {
            throw OpsInput.conflict("incomplete_call", "Marque todos os residentes antes de fechar a chamada.");
        }
        // A return recorded afterwards may show that the resident was back before the call opened.
        for (NightCall.ResidentMark mark : calls.marks(id)) {
            if ("AUSENCIA_JUSTIFICADA".equals(mark.mark()) && authorized(mark.residentId(), current.openedAt()).stream()
                    .noneMatch(exit -> exit.id().equals(mark.authorizedExitId()))) {
                throw OpsInput.conflict("authorized_exit_outdated", mark.residentName()
                        + " voltou antes do início da chamada. Corrija a marcação para fechar.");
            }
        }
        Instant now = now();
        boolean exceptional = outsideWindow(now) || !current.referenceDate().equals(today(now));
        String reason = exceptionReason(exceptional, confirmed, justification);
        NightCall closed = calls.close(current, now, actor.id(), exceptional, reason);
        audit.record(AuditResource.NIGHT_CALL, id, AuditAction.END, closed.version(),
                exceptional ? Set.of("status", "closedAt", "outsideWindowConfirmed", "justification")
                        : Set.of("status", "closedAt"));
        calls.marks(id).forEach(mark -> evidenceSinks.forEach(sink ->
                sink.reconcile("NIGHT_CALL", mark.id(), mark.residentId())));
        return view(closed);
    }

    private NightCall locked(UUID id, long version) {
        if (version < 0 || version == Long.MAX_VALUE) throw OpsInput.invalid("Versão inválida.");
        NightCall call = calls.find(id, true).orElseThrow(OpsInput::notFound);
        if (call.version() != version) throw OpsInput.conflict("stale_version", "A chamada foi alterada. Recarregue o registro.");
        return call;
    }

    private AuthorizedExitLookup.Reference authorization(NightCall call, UUID residentId, String mark,
            UUID id, String type) {
        if (!"AUSENCIA_JUSTIFICADA".equals(mark)) {
            if (id != null || type != null) throw OpsInput.invalid("Somente ausência justificada pode vincular saída.");
            return null;
        }
        if ((id == null) != (type == null)) throw OpsInput.invalid("Informe UUID e tipo da autorização juntos.");
        List<AuthorizedExitLookup.Reference> authorized = authorized(residentId, call.openedAt());
        if (id == null && authorized.size() == 1) return authorized.getFirst();
        return authorized.stream().filter(exit -> exit.id().equals(id) && exit.type().equals(type)).findFirst()
                .orElseThrow(() -> OpsInput.conflict("authorized_exit_required", "Selecione uma saída aprovada com partida física válida no instante da chamada."));
    }

    private List<AuthorizedExitLookup.Reference> authorized(UUID residentId, Instant at) {
        return exitLookups.stream().flatMap(lookup -> lookup.authorizedFor(residentId, at).stream()).distinct().toList();
    }

    private NightCall view(NightCall call) {
        List<NightCall.ResidentMark> residents = calls.marks(call.id()).stream().map(mark ->
                new NightCall.ResidentMark(mark.id(), mark.residentId(), mark.residentName(), mark.enrollment(),
                        mark.birthDate(), mark.roomId(), mark.roomNumber(), mark.mark(), mark.authorizedExitId(),
                        mark.authorizedExitType(), mark.version(), calls.history(mark.id()),
                        authorized(mark.residentId(), call.openedAt()))).toList();
        return call.view(residents);
    }

    private NightCall.AccommodationOption accommodation(UUID id, List<NightCall.AccommodationOption> options) {
        return options.stream().filter(option -> option.id().equals(id)).findFirst()
                .orElseThrow(() -> new OpsApiException(HttpStatus.UNPROCESSABLE_CONTENT, "invalid_reference", "Alojamento não encontrado."));
    }

    private String exceptionReason(boolean exceptional, boolean confirmed, String justification) {
        if (!exceptional) return null;
        if (!confirmed) throw OpsInput.conflict("outside_window", "Confirme o horário excepcional e informe justificativa.");
        reason(justification);
        return justification;
    }

    private void reason(String justification) {
        if (justification == null || OpsInput.characters(justification.trim()) < 10
                || OpsInput.characters(justification) > 2000) {
            throw OpsInput.invalid("Informe justificativa de 10 a 2000 caracteres.");
        }
    }

    private boolean outsideWindow(Instant at) {
        LocalTime time = at.atZone(OperationResidents.ZONE).toLocalTime();
        return time.isBefore(WINDOW_START) || time.isAfter(WINDOW_END);
    }

    private LocalDate today(Instant at) {
        return at.atZone(OperationResidents.ZONE).toLocalDate();
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private OpsApiException exists() {
        return OpsInput.conflict("call_exists", "Já existe chamada para esse alojamento e data.");
    }
}
