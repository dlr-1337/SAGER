package br.edu.ifgoiano.sager.integrations;

import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.instant;
import static br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.time;

import br.edu.ifgoiano.sager.operations.longexits.LongExit;
import br.edu.ifgoiano.sager.operations.longexits.LongExitGuardians.Guardian;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.Row;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
@Profile("local")
public class IntegrationRepository {
    private final JdbcTemplate jdbc;

    public IntegrationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public BindingData create(
            Row exit,
            Guardian guardian,
            Instant now,
            Instant expiry,
            String environment,
            boolean enabled) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                """
INSERT INTO sager_signature_binding(id,exit_id,document_version_id,guardian_id,guardian_version,
    guardian_name,guardian_relationship,guardian_phone,environment,status,expires_at,created_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
""",
                id,
                exit.id(),
                exit.documentVersionId(),
                guardian.id(),
                guardian.version(),
                guardian.name(),
                guardian.relationship(),
                guardian.phone(),
                environment,
                enabled ? "PENDING" : "UNAVAILABLE",
                time(expiry),
                time(now));
        return binding(id, false).orElseThrow();
    }

    public Optional<BindingData> binding(UUID id, boolean lock) {
        return jdbc
                .query(
                        "SELECT * FROM sager_signature_binding WHERE id=?"
                                + (lock ? " FOR UPDATE" : ""),
                        (r, n) ->
                                new BindingData(
                                        r.getObject("id", UUID.class),
                                        r.getObject("exit_id", UUID.class),
                                        r.getObject("document_version_id", UUID.class),
                                        r.getObject("guardian_id", UUID.class),
                                        r.getLong("guardian_version"),
                                        r.getString("guardian_name"),
                                        r.getString("guardian_relationship"),
                                        r.getString("guardian_phone"),
                                        r.getString("environment"),
                                        r.getString("status"),
                                        r.getString("stage"),
                                        r.getObject("envelope_id", UUID.class),
                                        r.getObject("provider_document_id", UUID.class),
                                        r.getObject("signer_id", UUID.class),
                                        r.getObject("agree_requirement_id", UUID.class),
                                        r.getObject("sms_requirement_id", UUID.class),
                                        r.getString("token_hash"),
                                        instant(r, "issued_at"),
                                        instant(r, "expires_at"),
                                        instant(r, "revoked_at"),
                                        instant(r, "signed_at"),
                                        instant(r, "verified_at"),
                                        r.getBoolean("verified_api"),
                                        r.getString("evidence_hash"),
                                        r.getString("failure_code"),
                                        instant(r, "created_at"),
                                        r.getLong("version")),
                        id)
                .stream()
                .findFirst();
    }

    public List<BindingData> current(Row exit) {
        return jdbc
                .query(
                        "SELECT id FROM sager_signature_binding WHERE exit_id=? AND"
                                + " document_version_id=? ORDER BY created_at DESC,id DESC",
                        (r, n) -> r.getObject(1, UUID.class),
                        exit.id(),
                        exit.documentVersionId())
                .stream()
                .map(id -> binding(id, false).orElseThrow())
                .toList();
    }

    public List<LongExit.Binding> views(UUID exitId, boolean whatsappAvailable, Instant now) {
        boolean pending =
                Boolean.TRUE.equals(
                        jdbc.queryForObject(
                                "SELECT status='AGUARDANDO_ANALISE' FROM sager_long_exit WHERE"
                                    + " id=?",
                                Boolean.class,
                                exitId));
        return jdbc
                .query(
                        "SELECT id FROM sager_signature_binding WHERE exit_id=? ORDER BY created_at"
                                + " DESC,id DESC",
                        (r, n) -> r.getObject(1, UUID.class),
                        exitId)
                .stream()
                .map(
                        id -> {
                            BindingData b = binding(id, false).orElseThrow();
                            String status = effectiveStatus(b, now);
                            if (pending
                                    && b.revokedAt() == null
                                    && Set.of("PENDING", "VALID", "EXPIRED").contains(b.status())
                                    && !guardianCurrent(b)) status = "INVALIDATED";
                            return new LongExit.Binding(
                                    b.id(),
                                    b.documentVersionId(),
                                    b.guardianId(),
                                    b.guardianName(),
                                    status,
                                    messageStatus(b.id(), whatsappAvailable),
                                    b.expiresAt(),
                                    b.createdAt(),
                                    b.revokedAt(),
                                    b.signedAt(),
                                    b.verifiedAt(),
                                    b.failureCode(),
                                    "DONE".equals(b.stage())
                                            && b.revokedAt() == null
                                            && now.isBefore(b.expiresAt())
                                            && "PENDING".equals(status));
                        })
                .toList();
    }

    public String messageStatus(UUID bindingId, boolean enabled) {
        return jdbc
                .query(
                        "SELECT status FROM sager_whatsapp_attempt WHERE binding_id=? ORDER BY"
                                + " created_at DESC,id DESC LIMIT 1",
                        (r, n) -> r.getString(1),
                        bindingId)
                .stream()
                .findFirst()
                .orElse(enabled ? "QUEUED" : "UNAVAILABLE");
    }

    public boolean guardianCurrent(BindingData binding) {
        return Boolean.TRUE.equals(
                jdbc.queryForObject(
                        """
SELECT EXISTS(SELECT 1 FROM sager_guardian g JOIN sager_long_exit e ON e.resident_id=g.resident_id
    WHERE e.id=? AND g.id=? AND g.active AND g.version=? AND g.name=? AND g.relationship=? AND g.phone=?)
""",
                        Boolean.class,
                        binding.exitId(),
                        binding.guardianId(),
                        binding.guardianVersion(),
                        binding.guardianName(),
                        binding.guardianRelationship(),
                        binding.guardianPhone()));
    }

    public List<UUID> invalidate(UUID exitId, UUID excluded, Instant now) {
        return jdbc.query(
                """
UPDATE sager_signature_binding SET status='INVALIDATED',revoked_at=?,version=version+1
WHERE exit_id=? AND (?::uuid IS NULL OR id<>?) AND revoked_at IS NULL RETURNING id
""",
                (r, n) -> r.getObject(1, UUID.class),
                time(now),
                exitId,
                excluded,
                excluded);
    }

    public void cancelPendingTasks(UUID bindingId, Instant now) {
        jdbc.update(
                "UPDATE sager_integration_task SET state='CANCELLED',version=version+1,updated_at=?"
                    + " WHERE binding_id=? AND type<>'CANCEL' AND state IN ('PENDING','RUNNING')",
                time(now),
                bindingId);
    }

    public UUID enqueue(UUID bindingId, String type, String key, Instant now) {
        UUID id = UUID.randomUUID();
        return jdbc
                .query(
                        """
INSERT INTO sager_integration_task(id,binding_id,type,idempotency_key,next_attempt_at,created_at,updated_at)
VALUES (?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id
""",
                        (r, n) -> r.getObject(1, UUID.class),
                        id,
                        bindingId,
                        type,
                        key,
                        time(now),
                        time(now),
                        time(now))
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void resend(UUID exitId, UUID bindingId, UUID actor, String reason, Instant now) {
        jdbc.update(
                "INSERT INTO"
                    + " sager_long_exit_resend(id,exit_id,binding_id,requested_at,actor_id,reason)"
                    + " VALUES (?,?,?,?,?,?)",
                UUID.randomUUID(),
                exitId,
                bindingId,
                time(now),
                actor,
                reason);
    }

    public int recentResends(UUID exitId, Instant now) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM sager_long_exit_resend WHERE exit_id=? AND requested_at>?",
                Integer.class,
                exitId,
                time(now.minusSeconds(86400)));
    }

    public Instant lastResend(UUID exitId) {
        return jdbc
                .query(
                        "SELECT created_at FROM sager_signature_binding WHERE exit_id=? ORDER BY"
                                + " created_at DESC LIMIT 1",
                        (r, n) -> instant(r, "created_at"),
                        exitId)
                .stream()
                .findFirst()
                .orElse(null);
    }

    public Instant oldestRecentResend(UUID exitId, Instant now) {
        return jdbc
                .query(
                        "SELECT requested_at FROM sager_long_exit_resend WHERE exit_id=? AND"
                                + " requested_at>? ORDER BY requested_at LIMIT 1",
                        (r, n) -> instant(r, "requested_at"),
                        exitId,
                        time(now.minusSeconds(86400)))
                .stream()
                .findFirst()
                .orElse(null);
    }

    public static String effectiveStatus(BindingData b, Instant now) {
        return "PENDING".equals(b.status()) && !now.isBefore(b.expiresAt())
                ? "EXPIRED"
                : b.status();
    }

    public record BindingData(
            UUID id,
            UUID exitId,
            UUID documentVersionId,
            UUID guardianId,
            long guardianVersion,
            String guardianName,
            String guardianRelationship,
            String guardianPhone,
            String environment,
            String status,
            String stage,
            UUID envelopeId,
            UUID providerDocumentId,
            UUID signerId,
            UUID agreeRequirementId,
            UUID smsRequirementId,
            String tokenHash,
            Instant issuedAt,
            Instant expiresAt,
            Instant revokedAt,
            Instant signedAt,
            Instant verifiedAt,
            boolean verifiedApi,
            String evidenceHash,
            String failureCode,
            Instant createdAt,
            long version) {}
}
