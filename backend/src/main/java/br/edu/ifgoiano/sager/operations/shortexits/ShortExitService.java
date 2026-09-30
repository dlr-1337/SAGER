package br.edu.ifgoiano.sager.operations.shortexits;

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

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import br.edu.ifgoiano.sager.operations.AuthorizedExitLookup;
import br.edu.ifgoiano.sager.operations.ExitOccupancyLookup;
import br.edu.ifgoiano.sager.operations.OperationResidents;
import br.edu.ifgoiano.sager.operations.OccurrenceEvidenceSink;
import br.edu.ifgoiano.sager.operations.OperationResidents.Eligibility;
import br.edu.ifgoiano.sager.operations.OpsActor;
import br.edu.ifgoiano.sager.operations.OpsInput;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
public class ShortExitService {
    private static final Set<String> STATUSES = Set.of(ShortExit.PENDING, ShortExit.APPROVED,
            ShortExit.IN_PROGRESS, "REJEITADA", "CANCELADA", "EXPIRADA", "RETORNO_CONFIRMADO",
            "RETORNO_CONFIRMADO_COM_ATRASO");
    private final ShortExitRepository exits;
    private final OperationResidents residents;
    private final OpsActor actors;
    private final AuditService audit;
    private final Clock clock;
    private final List<ExitOccupancyLookup> occupancies;
    private final List<OccurrenceEvidenceSink> evidenceSinks;

    public ShortExitService(ShortExitRepository exits, OperationResidents residents, OpsActor actors,
            AuditService audit, Clock clock, List<ExitOccupancyLookup> occupancies,
            List<OccurrenceEvidenceSink> evidenceSinks) {
        this.exits = exits;
        this.residents = residents;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.occupancies = List.copyOf(occupancies);
        this.evidenceSinks = List.copyOf(evidenceSinks);
    }

    @Transactional(readOnly = true)
    public Eligibility eligibility() {
        return residents.eligibility(actors.resident().residentId(), now());
    }

    @Transactional(readOnly = true)
    public List<ShortExit> list(UUID residentId, String search, String status) {
        LocalAccountPrincipal actor = readableActor();
        if ("residente".equals(actor.profile())) {
            if (residentId != null && !residentId.equals(actor.residentId())) throw OpsInput.notFound();
            residentId = actor.residentId();
        }
        if (status != null && !STATUSES.contains(status)) throw OpsInput.invalid("Situação inválida.");
        if (search != null && search.length() > 200) throw OpsInput.invalid("Busca muito longa.");
        return exits.list(residentId, search, status).stream().map(exit -> view(exit, actor)).toList();
    }

    @Transactional(readOnly = true)
    public ShortExit get(UUID id) {
        LocalAccountPrincipal actor = readableActor();
        ShortExit exit = visible(id, actor);
        return view(exit, actor);
    }

    @Transactional
    public ShortExit create(Plan request) {
        LocalAccountPrincipal actor = actors.resident();
        lockResident(actor.residentId());
        Instant now = now();
        Eligibility resident = eligible(actor.residentId(), now);
        Plan plan = plan(request, now);
        noOverlap(actor.residentId(), null, plan, now);
        ShortExit created = exits.insert(UUID.randomUUID(), resident, plan, now);
        record(created, "CREATE", now, null, actor, null, AuditAction.CREATE,
                Set.of("residentId", "departureMode", "requestedDepartureAt", "expectedReturnAt",
                        "reason", "notes", "status"));
        return view(created, actor);
    }

    @Transactional
    public ShortExit update(UUID id, long version, Plan request) {
        LocalAccountPrincipal actor = actors.resident();
        ShortExit current = lockedVisible(id, actor);
        checkVersion(current, version);
        requireStatus(current, ShortExit.PENDING);
        Instant now = now();
        checkDeadline(current, now);
        eligible(current.residentId(), now);
        Plan plan = plan(request, now);
        noOverlap(current.residentId(), id, plan, now);
        Map<String, Object> changes = new HashMap<>();
        changes.put("departure_mode", plan.departureMode());
        changes.put("requested_departure_at", plan.requestedDepartureAt());
        changes.put("expected_return_at", plan.expectedReturnAt());
        changes.put("reason", plan.reason());
        changes.put("notes", plan.notes());
        ShortExit updated = changed(current, changes, now);
        record(updated, "EDIT", now, null, actor, null, AuditAction.UPDATE,
                changedPlanFields(current, updated));
        return view(updated, actor);
    }

    @Transactional
    public ShortExit decide(UUID id, long version, String decision, String comment) {
        LocalAccountPrincipal actor = actors.supervisor();
        if (!Set.of("APPROVE", "REJECT").contains(decision)) throw OpsInput.invalid("Decisão inválida.");
        if ("REJECT".equals(decision)) reason(comment);
        ShortExit current = lockedVisible(id, actor);
        checkVersion(current, version);
        requireStatus(current, ShortExit.PENDING);
        Instant now = now();
        checkDeadline(current, now);
        if ("APPROVE".equals(decision)) eligible(current.residentId(), now);
        Map<String, Object> changes = new HashMap<>();
        changes.put("status", "APPROVE".equals(decision) ? ShortExit.APPROVED : "REJEITADA");
        changes.put("decision", decision);
        changes.put("decision_comment", comment);
        changes.put("decided_at", now);
        ShortExit updated = changed(current, changes, now);
        record(updated, decision, now, null, actor, comment, AuditAction.UPDATE,
                Objects.equals(current.decisionComment(), updated.decisionComment())
                        ? Set.of("status", "decision") : Set.of("status", "decision", "decisionComment"));
        return view(updated, actor);
    }

    @Transactional
    public ShortExit cancel(UUID id, long version, String comment) {
        LocalAccountPrincipal actor = readableActor();
        reason(comment);
        ShortExit current = lockedVisible(id, actor);
        checkVersion(current, version);
        if (!ShortExit.PENDING.equals(current.status())
                && !("supervisor".equals(actor.profile()) && ShortExit.APPROVED.equals(current.status()))) {
            throw OpsInput.conflict("invalid_state", "A solicitação não permite cancelamento.");
        }
        Instant now = now();
        checkDeadline(current, now);
        ShortExit updated = changed(current, Map.of("status", "CANCELADA", "cancellation_reason", comment), now);
        record(updated, "CANCEL", now, null, actor, comment, AuditAction.END,
                Set.of("status", "cancellationReason"));
        return view(updated, actor);
    }

    @Transactional
    public ShortExit depart(UUID id, long version, PhysicalTime request) {
        LocalAccountPrincipal actor = actors.supervisor();
        ShortExit current = lockedVisible(id, actor);
        checkVersion(current, version);
        requireStatus(current, ShortExit.APPROVED);
        Instant now = now();
        checkDeadline(current, now);
        eligible(current.residentId(), now);
        Instant departure = physicalTime(request, now);
        if (departure.isBefore(current.requestedDepartureAt()) || departure.isBefore(current.decidedAt())
                || !departure.isBefore(current.expectedReturnAt())) {
            throw OpsInput.invalid("A partida física deve seguir a partida solicitada e a aprovação, antes do retorno previsto.");
        }
        if (occupancies.stream().anyMatch(provider -> provider.physicalOpenFor(current.residentId()))) {
            throw OpsInput.conflict("physical_exit_conflict", "O residente possui outra saída em andamento.");
        }
        ShortExit updated = changed(current, Map.of("status", ShortExit.IN_PROGRESS,
                "actual_departure_at", departure), now);
        record(updated, "DEPARTURE", now, departure, actor, request.justification(), AuditAction.UPDATE,
                Set.of("status", "actualDepartureAt"));
        return view(updated, actor);
    }

    @Transactional
    public ShortExit returnFromExit(UUID id, long version, PhysicalTime request, String lateObservation) {
        LocalAccountPrincipal actor = actors.supervisor();
        ShortExit current = lockedVisible(id, actor);
        checkVersion(current, version);
        requireStatus(current, ShortExit.IN_PROGRESS);
        Instant now = now();
        Instant returning = physicalTime(request, now);
        if (!returning.isAfter(current.actualDepartureAt())) {
            throw OpsInput.invalid("O retorno físico deve ser posterior à partida física.");
        }
        boolean late = returning.isAfter(current.expectedReturnAt());
        if (late) reason(lateObservation);
        Map<String, Object> changes = new HashMap<>();
        changes.put("status", late ? "RETORNO_CONFIRMADO_COM_ATRASO" : "RETORNO_CONFIRMADO");
        changes.put("actual_return_at", returning);
        changes.put("late_observation", lateObservation);
        ShortExit updated = changed(current, changes, now);
        record(updated, "RETURN", now, returning, actor, request.justification(), AuditAction.END,
                Objects.equals(current.lateObservation(), updated.lateObservation())
                        ? Set.of("status", "actualReturnAt") : Set.of("status", "actualReturnAt", "lateObservation"));
        evidenceSinks.forEach(sink -> sink.reconcile("SHORT_RETURN", updated.id(), updated.residentId()));
        return view(updated, actor);
    }

    private LocalAccountPrincipal readableActor() {
        LocalAccountPrincipal actor = actors.current();
        return "supervisor".equals(actor.profile()) ? actors.supervisor() : actors.resident();
    }

    private ShortExit visible(UUID id, LocalAccountPrincipal actor) {
        ShortExit exit = exits.find(id, false).orElseThrow(OpsInput::notFound);
        if ("residente".equals(actor.profile()) && !exit.residentId().equals(actor.residentId())) {
            throw OpsInput.notFound();
        }
        return exit;
    }

    private ShortExit lockedVisible(UUID id, LocalAccountPrincipal actor) {
        ShortExit original = visible(id, actor);
        lockResident(original.residentId());
        return exits.find(id, true).orElseThrow(OpsInput::notFound);
    }

    private void lockResident(UUID id) {
        if (!residents.lock(id)) throw OpsInput.notFound();
    }

    private Eligibility eligible(UUID id, Instant now) {
        Eligibility info = residents.eligibility(id, now);
        if (!info.eligible()) throw OpsInput.conflict("not_eligible", "A saída exige residente menor de idade com nascimento informado e alocação ativa.");
        return info;
    }

    private Plan plan(Plan request, Instant now) {
        if (request == null || request.departureMode() == null
                || !Set.of("NOW", "SCHEDULED").contains(request.departureMode())) {
            throw OpsInput.invalid("departureMode deve ser NOW ou SCHEDULED.");
        }
        Instant departure;
        if ("NOW".equals(request.departureMode())) {
            if (request.requestedDepartureAt() != null) throw OpsInput.invalid("NOW usa somente o horário do servidor.");
            departure = now;
        } else {
            departure = normalize(request.requestedDepartureAt());
            if (departure == null || departure.isBefore(now)) throw OpsInput.invalid("A partida agendada não pode ser passada.");
        }
        Instant returning = normalize(request.expectedReturnAt());
        if (returning == null || !returning.isAfter(departure)
                || Duration.between(departure, returning).compareTo(Duration.ofHours(3)) > 0) {
            throw OpsInput.invalid("O retorno previsto deve superar a partida em até três horas.");
        }
        if (request.reason() == null || OpsInput.characters(request.reason()) < 3
                || OpsInput.characters(request.reason()) > 2000) {
            throw OpsInput.invalid("Informe o motivo da saída, de 3 a 2000 caracteres.");
        }
        return new Plan(request.departureMode(), departure, returning, request.reason(), request.notes());
    }

    private void noOverlap(UUID residentId, UUID excluded, Plan plan, Instant now) {
        AuthorizedExitLookup.Reference excludedExit = excluded == null ? null
                : new AuthorizedExitLookup.Reference(excluded, "SHORT");
        if (occupancies.stream().anyMatch(provider -> provider.overlaps(residentId, excludedExit,
                plan.requestedDepartureAt(), plan.expectedReturnAt(), now))) {
            throw OpsInput.conflict("overlapping_exit", "Outra solicitação ativa ocupa esse intervalo.");
        }
    }

    private Instant physicalTime(PhysicalTime request, Instant now) {
        if (request == null || request.timeMode() == null) throw OpsInput.invalid("Informe o modo de horário.");
        if ("NOW".equals(request.timeMode())) {
            if (request.occurredAt() != null || request.justification() != null) {
                throw OpsInput.invalid("NOW usa somente o horário do servidor.");
            }
            return now;
        }
        if (!"RETROACTIVE".equals(request.timeMode())) throw OpsInput.invalid("Modo de horário inválido.");
        reason(request.justification());
        Instant time = normalize(request.occurredAt());
        if (time == null || time.isAfter(now)) throw OpsInput.invalid("O horário retroativo não pode ser futuro.");
        return time;
    }

    private void requireStatus(ShortExit exit, String status) {
        if (!status.equals(exit.status())) throw OpsInput.conflict("invalid_state", "A situação atual não permite essa ação.");
    }

    private void checkVersion(ShortExit exit, long version) {
        if (version < 0 || version == Long.MAX_VALUE) throw OpsInput.invalid("Versão inválida.");
        if (exit.version() != version) throw OpsInput.conflict("stale_version", "A solicitação foi alterada. Recarregue o registro.");
    }

    private void checkDeadline(ShortExit exit, Instant now) {
        if (exit.deadline() != null && !now.isBefore(exit.deadline())) {
            throw OpsInput.conflict("deadline_passed", "O prazo desta solicitação encerrou. Aguarde a atualização da situação.");
        }
    }

    private void reason(String value) {
        if (value == null || OpsInput.characters(value.trim()) < 10 || OpsInput.characters(value) > 2000) {
            throw OpsInput.invalid("Informe uma justificativa de 10 a 2000 caracteres.");
        }
    }

    private ShortExit changed(ShortExit current, Map<String, Object> changes, Instant now) {
        ShortExit updated = exits.update(current.id(), current.version(), changes, now);
        if (updated == null) throw OpsInput.conflict("stale_version", "A solicitação foi alterada.");
        return updated;
    }

    private void record(ShortExit exit, String event, Instant now, Instant effectiveAt,
            LocalAccountPrincipal actor, String justification, AuditAction action, Set<String> fields) {
        exits.history(exit, event, now, effectiveAt, actor.id(), actor.profile(), "LOCAL_API", justification);
        audit.record(AuditResource.SHORT_EXIT, exit.id(), action, exit.version(), fields);
    }

    private Set<String> changedPlanFields(ShortExit before, ShortExit after) {
        Set<String> fields = new HashSet<>();
        if (!Objects.equals(before.departureMode(), after.departureMode())) fields.add("departureMode");
        if (!Objects.equals(before.requestedDepartureAt(), after.requestedDepartureAt())) fields.add("requestedDepartureAt");
        if (!Objects.equals(before.expectedReturnAt(), after.expectedReturnAt())) fields.add("expectedReturnAt");
        if (!Objects.equals(before.reason(), after.reason())) fields.add("reason");
        if (!Objects.equals(before.notes(), after.notes())) fields.add("notes");
        return Set.copyOf(fields);
    }

    private ShortExit view(ShortExit exit, LocalAccountPrincipal actor) {
        Instant now = now();
        boolean supervisor = "supervisor".equals(actor.profile());
        boolean pending = ShortExit.PENDING.equals(exit.status());
        boolean approved = ShortExit.APPROVED.equals(exit.status());
        boolean live = exit.deadline() == null || now.isBefore(exit.deadline());
        ShortExit.Capabilities capabilities = new ShortExit.Capabilities(!supervisor && pending && live,
                supervisor && pending && live, live && (pending || supervisor && approved),
                supervisor && approved && live && !now.isBefore(exit.requestedDepartureAt()),
                supervisor && ShortExit.IN_PROGRESS.equals(exit.status()));
        return exit.view(now, capabilities, exits.history(exit.id()));
    }

    private Instant now() {
        return normalize(clock.instant());
    }

    private Instant normalize(Instant value) {
        return value == null ? null : value.truncatedTo(ChronoUnit.MICROS);
    }

    public record Plan(String departureMode, Instant requestedDepartureAt, Instant expectedReturnAt,
            String reason, String notes) {
    }

    public record PhysicalTime(String timeMode, Instant occurredAt, String justification) {
    }
}
