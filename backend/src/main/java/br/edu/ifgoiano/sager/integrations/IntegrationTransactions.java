package br.edu.ifgoiano.sager.integrations;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.instant;
import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository.BindingData;
import br.edu.ifgoiano.sager.integrations.WhatsAppGateway.InboundMessage;
import br.edu.ifgoiano.sager.operations.OperationResidents;
import br.edu.ifgoiano.sager.operations.longexits.LongExit;
import br.edu.ifgoiano.sager.operations.longexits.LongExitGuardians;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.Row;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Each method commits before the worker performs external I/O. */
@Service
@Profile({ "local", "production" })
public class IntegrationTransactions {
    private final JdbcTemplate jdbc;
    private final IntegrationRepository repository;
    private final LongExitRepository exits;
    private final LongExitGuardians guardians;
    private final OperationResidents residents;
    private final AuditService audit;
    private final Clock clock;
    private final ObjectMapper json;
    private final WhatsAppInbound inbound;

    public IntegrationTransactions(
            JdbcTemplate jdbc,
            IntegrationRepository repository,
            LongExitRepository exits,
            LongExitGuardians guardians,
            OperationResidents residents,
            AuditService audit,
            Clock clock,
            ObjectMapper json,
            WhatsAppInbound inbound) {
        this.jdbc = jdbc;
        this.repository = repository;
        this.exits = exits;
        this.guardians = guardians;
        this.residents = residents;
        this.audit = audit;
        this.clock = clock;
        this.json = json;
        this.inbound = inbound;
    }

    @Transactional
    public Task claim() {
        Instant now = now();
        Task old =
                jdbc
                        .query(
                                """
                                SELECT * FROM sager_integration_task
                                WHERE (state='PENDING' AND next_attempt_at<=?)
                                    OR (state='RUNNING' AND lease_until<=?)
                                ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
                                """,
                                (r, n) -> task(r),
                                time(now),
                                time(now))
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (old == null) return null;
        UUID owner = UUID.randomUUID();
        boolean unsafe = old.inFlight() && "WHATSAPP".equals(old.type());
        int count = unsafe ? old.attemptCount() : Math.min(5, old.attemptCount() + 1);
        jdbc.update(
                """
                UPDATE sager_integration_task SET state='RUNNING',attempt_count=?,lease_until=?,
                    lease_owner=?,in_flight=false,version=version+1,updated_at=? WHERE id=?
                """,
                count,
                time(now.plusSeconds(120)),
                owner,
                time(now),
                old.id());
        Task claimed = task(old.id(), false);
        system(
                old.id(),
                AuditResource.INTEGRATION_TASK,
                old.id(),
                claimed.version(),
                Set.of("state", "attemptCount", "leaseUntil"));
        return new Task(
                claimed.id(),
                claimed.bindingId(),
                claimed.type(),
                claimed.state(),
                claimed.attemptCount(),
                unsafe,
                claimed.leaseOwner(),
                claimed.version(),
                !unsafe && old.attemptCount() >= 5);
    }

    @Transactional
    public BindingData begin(Task task) {
        Locked locked = lock(task);
        if (locked == null) return null;
        if (!live(locked.exit(), locked.binding(), now())) {
            finish(task, "CANCELLED", null, now());
            return null;
        }
        boolean eligible;
        try {
            var g = guardians.require(locked.exit().residentId(), locked.binding().guardianId());
            var b = locked.binding();
            eligible =
                    g.version() == b.guardianVersion()
                            && g.phone().equals(b.guardianPhone())
                            && g.name().equals(b.guardianName())
                            && g.relationship().equals(b.guardianRelationship())
                            && residents.eligibility(locked.exit().residentId(), now()).eligible();
        } catch (br.edu.ifgoiano.sager.operations.longexits.LongExitApiException invalid) {
            eligible = false;
        }
        if (!eligible) {
            finish(task, "CANCELLED", null, now());
            return null;
        }
        jdbc.update(
                """
                UPDATE sager_integration_task SET in_flight=true,lease_until=?,version=version+1,
                    updated_at=? WHERE id=? AND lease_owner=? AND state='RUNNING'
                """,
                time(now().plusSeconds(120)),
                time(now()),
                task.id(),
                task.leaseOwner());
        system(
                task.id(),
                AuditResource.INTEGRATION_TASK,
                task.id(),
                task(task.id(), false).version(),
                Set.of("leaseUntil"));
        return locked.binding();
    }

    @Transactional
    public Send beginSend(Task task) {
        BindingData binding = begin(task);
        if (binding == null) return null;
        Instant now = now();
        UUID attempt = UUID.randomUUID();
        String recipient = binding.guardianPhone().substring(1);
        jdbc.update(
                "INSERT INTO sager_whatsapp_attempt(id,binding_id,recipient,status,created_at)"
                        + " VALUES (?,?,?,'QUEUED',?)",
                attempt,
                binding.id(),
                recipient,
                time(now));
        audit.recordSystem(
                task.id(),
                AuditResource.WHATSAPP_ATTEMPT,
                attempt,
                AuditAction.CREATE,
                0,
                Set.of("bindingId", "status"));
        return new Send(binding, attempt, recipient);
    }

    @Transactional
    public void sent(Task task, UUID attempt, String messageId) {
        Locked locked = lock(task);
        Instant now = now();
        // The message left even if an edit cancelled the task: its delivery state must stay known.
        jdbc.update(
                """
UPDATE sager_whatsapp_attempt SET status='ACCEPTED',provider_message_id=?,accepted_at=?,
    status_at=?,version=version+1 WHERE id=? AND binding_id=? AND status='QUEUED'
""",
                messageId,
                time(now),
                time(now),
                attempt,
                task.bindingId());
        system(
                task.id(),
                AuditResource.WHATSAPP_ATTEMPT,
                attempt,
                1,
                Set.of("status", "providerMessageId", "acceptedAt"));
        if (locked != null) finish(task, "SUCCEEDED", null, now);
    }

    @Transactional
    public void fail(Task task, ProviderFailure failure, UUID messageAttempt) {
        Locked locked = lock(task);
        if (locked == null) return;
        Instant now = now();
        boolean retry = failure.kind() == ProviderFailure.Kind.RETRYABLE && task.attemptCount() < 5;
        String state =
                retry
                        ? "PENDING"
                        : failure.kind() == ProviderFailure.Kind.UNCERTAIN ? "UNCERTAIN" : "FAILED";
        long wait =
                switch (task.attemptCount()) {
                    case 1 -> 60;
                    case 2 -> 300;
                    default -> 900;
                };
        jdbc.update(
                """
UPDATE sager_integration_task SET state=?,in_flight=false,lease_until=NULL,lease_owner=NULL,
    next_attempt_at=?,failure_code=?,version=version+1,updated_at=? WHERE id=?
""",
                state,
                time(now.plusSeconds(retry ? wait : 0)),
                failure.code(),
                time(now),
                task.id());
        system(
                task.id(),
                AuditResource.INTEGRATION_TASK,
                task.id(),
                task(task.id(), false).version(),
                Set.of("state", "nextAttemptAt", "failureCode"));
        if (messageAttempt != null) {
            String messageState = "UNCERTAIN".equals(state) ? "UNCERTAIN" : "FAILED";
            jdbc.update(
                    "UPDATE sager_whatsapp_attempt SET status=?,failure_code=?,version=version+1"
                            + " WHERE id=?",
                    messageState,
                    failure.code(),
                    messageAttempt);
            Long version =
                    jdbc.queryForObject(
                            "SELECT version FROM sager_whatsapp_attempt WHERE id=?",
                            Long.class,
                            messageAttempt);
            system(
                    task.id(),
                    AuditResource.WHATSAPP_ATTEMPT,
                    messageAttempt,
                    version,
                    Set.of("status", "failureCode"));
        } else if ("UNCERTAIN".equals(state)) {
            // The worker fell during the send: this attempt may have reached the guardian.
            jdbc.query(
                            """
UPDATE sager_whatsapp_attempt SET status='UNCERTAIN',failure_code=?,version=version+1
WHERE binding_id=? AND status='QUEUED' RETURNING id,version
""",
                            (r, n) -> Map.entry(r.getObject(1, UUID.class), r.getLong(2)),
                            failure.code(),
                            task.bindingId())
                    .forEach(
                            attempt ->
                                    system(
                                            task.id(),
                                            AuditResource.WHATSAPP_ATTEMPT,
                                            attempt.getKey(),
                                            attempt.getValue(),
                                            Set.of("status", "failureCode")));
        }
    }

    public UUID nextInbox() {
        return jdbc
                .query(
                        "SELECT id FROM sager_webhook_inbox WHERE processed_at IS NULL ORDER BY"
                                + " received_at,id LIMIT 1",
                        (r, n) -> r.getObject(1, UUID.class))
                .stream()
                .findFirst()
                .orElse(null);
    }

    /** A failure rolls this back and the worker marks the row, so it cannot block the queue. */
    @Transactional
    public void consumeInbox(UUID id) {
        Instant now = now();
        Inbox event =
                jdbc
                        .query(
                                "SELECT * FROM sager_webhook_inbox WHERE id=? AND processed_at IS"
                                        + " NULL FOR UPDATE SKIP LOCKED",
                                (r, n) ->
                                        new Inbox(
                                                r.getObject("id", UUID.class),
                                                json.readTree(r.getString("payload"))),
                                id)
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (event == null) return;
        JsonNode p = event.payload();
        switch (p.path("kind").asString("")) {
            case "MESSAGE" ->
                    inbound.record(
                            json.treeToValue(p.path("message"), InboundMessage.class), "WEBHOOK");
            case "ACK" -> messageEvent(event, now);
            case "SESSION_END" -> inbound.auditSessionEnd(event.id());
            default -> throw new IllegalArgumentException("Evento desconhecido.");
        }
        jdbc.update(
                "UPDATE sager_webhook_inbox SET processed_at=? WHERE id=?", time(now), event.id());
    }

    @Transactional
    public void failInbox(UUID id, String code) {
        jdbc.update(
                "UPDATE sager_webhook_inbox SET processed_at=?,failure_code=? WHERE id=? AND"
                        + " processed_at IS NULL",
                time(now()),
                code,
                id);
    }

    private void messageEvent(Inbox event, Instant now) {
        JsonNode p = event.payload();
        inbound.delivered(p.path("messageId").asString(), p.path("status").asString());
        Message old =
                jdbc
                        .query(
                                """
SELECT a.* FROM sager_whatsapp_attempt a JOIN sager_signature_binding b ON b.id=a.binding_id
JOIN sager_long_exit e ON e.id=b.exit_id
WHERE a.provider_message_id=? AND b.revoked_at IS NULL
    AND b.document_version_id=e.current_document_version_id FOR UPDATE OF a
""",
                                (r, n) ->
                                        new Message(
                                                r.getObject("id", UUID.class),
                                                r.getString("status"),
                                                instant(r, "status_at"),
                                                r.getLong("version")),
                                p.path("messageId").asString())
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (old == null) return;
        String status = p.path("status").asString();
        Instant at = Instant.parse(p.path("at").asString());
        if (at.isAfter(now)) at = now;
        // Confirmations may arrive out of order: delivery state only moves forward.
        if ("FAILED".equals(status) ? rank(old.status()) >= 2 : rank(status) <= rank(old.status()))
            return;
        String column =
                switch (status) {
                    case "SENT" -> "sent_at";
                    case "DELIVERED" -> "delivered_at";
                    case "READ" -> "read_at";
                    default -> null;
                };
        if (column == null)
            jdbc.update(
                    "UPDATE sager_whatsapp_attempt SET status=?,status_at=?,version=version+1 WHERE"
                            + " id=?",
                    status,
                    time(at),
                    old.id());
        else
            jdbc.update(
                    "UPDATE sager_whatsapp_attempt SET status=?,status_at=?,"
                            + column
                            + "=?,version=version+1 WHERE id=?",
                    status,
                    time(at),
                    time(at),
                    old.id());
        Set<String> fields =
                switch (status) {
                    case "DELIVERED" -> Set.of("status", "deliveredAt");
                    case "READ" -> Set.of("status", "readAt");
                    default -> Set.of("status");
                };
        system(event.id(), AuditResource.WHATSAPP_ATTEMPT, old.id(), old.version() + 1, fields);
    }

    private static int rank(String status) {
        return switch (status) {
            case "READ" -> 3;
            case "DELIVERED" -> 2;
            case "SENT", "FAILED" -> 1;
            default -> 0;
        };
    }

    private Locked lock(Task task) {
        BindingData before = repository.binding(task.bindingId(), false).orElseThrow();
        Row exit = exits.find(before.exitId(), false).orElseThrow();
        residents.lock(exit.residentId());
        exit = exits.find(exit.id(), true).orElseThrow();
        BindingData binding = repository.binding(before.id(), true).orElseThrow();
        Task current = task(task.id(), true);
        return owns(current, task) ? new Locked(exit, binding) : null;
    }

    private boolean live(Row exit, BindingData binding, Instant now) {
        return LongExit.PENDING.equals(exit.status())
                && exit.documentVersionId().equals(binding.documentVersionId())
                && binding.revokedAt() == null
                && "PENDING".equals(binding.status())
                && (exit.deadline() == null || now.isBefore(exit.deadline()))
                && now.isBefore(binding.expiresAt());
    }

    private boolean owns(Task current, Task claimed) {
        return current != null
                && "RUNNING".equals(current.state())
                && claimed.leaseOwner().equals(current.leaseOwner());
    }

    private void finish(Task task, String state, String code, Instant now) {
        jdbc.update(
                """
UPDATE sager_integration_task SET state=?,in_flight=false,lease_until=NULL,lease_owner=NULL,
    failure_code=?,version=version+1,updated_at=? WHERE id=? AND state='RUNNING' AND lease_owner=?
""",
                state,
                code,
                time(now),
                task.id(),
                task.leaseOwner());
        system(
                task.id(),
                AuditResource.INTEGRATION_TASK,
                task.id(),
                task(task.id(), false).version(),
                Set.of("state"));
    }

    private void system(
            UUID correlation, AuditResource resource, UUID id, long version, Set<String> fields) {
        audit.recordSystem(correlation, resource, id, AuditAction.UPDATE, version, fields);
    }

    private Task task(UUID id, boolean lock) {
        return jdbc
                .query(
                        "SELECT * FROM sager_integration_task WHERE id=?"
                                + (lock ? " FOR UPDATE" : ""),
                        (r, n) -> task(r),
                        id)
                .stream()
                .findFirst()
                .orElse(null);
    }

    private Task task(ResultSet r) throws SQLException {
        return new Task(
                r.getObject("id", UUID.class),
                r.getObject("binding_id", UUID.class),
                r.getString("type"),
                r.getString("state"),
                r.getInt("attempt_count"),
                r.getBoolean("in_flight"),
                r.getObject("lease_owner", UUID.class),
                r.getLong("version"),
                false);
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    public record Task(
            UUID id,
            UUID bindingId,
            String type,
            String state,
            int attemptCount,
            boolean inFlight,
            UUID leaseOwner,
            long version,
            boolean exhausted) {}

    public record Send(BindingData binding, UUID attemptId, String recipient) {}

    private record Locked(Row exit, BindingData binding) {}

    private record Inbox(UUID id, JsonNode payload) {}

    private record Message(UUID id, String status, Instant statusAt, long version) {}
}
