package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

class WhatsAppAuthorizationMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");
    private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 10, 1, 1, 0, 0, 0, ZoneOffset.UTC);

    static {
        POSTGRES.start();
    }

    @Test
    void upgradeClosesOpenLegacyAuthorizationsAndKeepsFinishedOnes() {
        String schema = "whatsapp_upgrade";
        migrate(schema, "22");
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = UUID.randomUUID(), guardian = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,'Residente Sintético','MIG-A',?)",
                resident,
                LocalDate.of(2009, 1, 1));
        jdbc.update(
                "INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active)"
                        + " VALUES (?,?,'Responsável sintético','Mãe','+5562999990000',true)",
                guardian,
                resident);
        UUID pending = binding(jdbc, resident, guardian, "AGUARDANDO_ANALISE", "PENDING");
        UUID running = task(jdbc, pending, "PROVISION", "RUNNING");
        UUID queued = task(jdbc, pending, "WHATSAPP", "PENDING");
        UUID finished = task(jdbc, pending, "CANCEL", "SUCCEEDED");
        UUID validPending = binding(jdbc, resident, guardian, "AGUARDANDO_ANALISE", "VALID");
        UUID validApproved = binding(jdbc, resident, guardian, "APROVADA", "VALID");
        jdbc.update(
                "INSERT INTO sager_webhook_inbox(id,provider,environment,event_key,payload,received_at)"
                        + " VALUES (?,'CLICKSIGN','sandbox',repeat('a',64),'{}'::jsonb,?)",
                UUID.randomUUID(),
                NOW);

        migrate(schema, "23");

        assertThat(status(jdbc, pending)).isEqualTo("INVALIDATED");
        assertThat(status(jdbc, validPending)).isEqualTo("INVALIDATED");
        assertThat(status(jdbc, validApproved)).isEqualTo("VALID");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT revoked_at IS NOT NULL FROM sager_signature_binding WHERE id=?",
                                Boolean.class,
                                pending))
                .isTrue();
        assertThat(taskState(jdbc, running)).isEqualTo("CANCELLED");
        assertThat(taskState(jdbc, queued)).isEqualTo("CANCELLED");
        assertThat(taskState(jdbc, finished)).isEqualTo("SUCCEEDED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT failure_code FROM sager_webhook_inbox", String.class))
                .isEqualTo("provider_removed");
    }

    @Test
    void newSchemaRequiresHumanVerificationAndKeepsReceivedFilesImmutable() {
        String schema = "whatsapp_fresh";
        migrate(schema, "23");
        JdbcTemplate jdbc = jdbc(schema);
        UUID resident = UUID.randomUUID(), guardian = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,'Residente Sintético','MIG-B',?)",
                resident,
                LocalDate.of(2009, 1, 1));
        jdbc.update(
                "INSERT INTO sager_guardian(id,resident_id,name,relationship,phone,active)"
                        + " VALUES (?,?,'Responsável sintético','Mãe','+5562999990000',true)",
                guardian,
                resident);
        UUID binding = binding(jdbc, resident, guardian, "AGUARDANDO_ANALISE", "PENDING");
        jdbc.update("UPDATE sager_signature_binding SET provider='WHATSAPP_GATEWAY',environment='gateway' WHERE id=?", binding);
        String valid =
                "UPDATE sager_signature_binding SET status='VALID',stage='DONE',signed_at=created_at,"
                        + "verified_at=created_at,evidence_hash=repeat('a',64)";
        assertThatThrownBy(() -> jdbc.update(valid + " WHERE id=?", binding))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.update(valid + ",verified_by=gen_random_uuid() WHERE id=?", binding)).isEqualTo(1);

        UUID exit =
                jdbc.queryForObject(
                        "SELECT exit_id FROM sager_signature_binding WHERE id=?", UUID.class, binding);
        UUID document =
                jdbc.queryForObject(
                        "SELECT document_version_id FROM sager_signature_binding WHERE id=?",
                        UUID.class,
                        binding);
        UUID file = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO sager_guardian_authorization_file(id,exit_id,document_version_id,binding_id,origin,state,
                    file_id,file_hash,file_size,media_type,received_at,created_at)
                VALUES (?,?,?,?,'MANUAL','CANDIDATE',?,repeat('b',64),10,'image/jpeg',?,?)
                """,
                file,
                exit,
                document,
                binding,
                UUID.randomUUID(),
                NOW,
                NOW);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE sager_guardian_authorization_file SET file_hash=repeat('c',64) WHERE id=?",
                                        file))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE sager_guardian_authorization_file SET media_type='text/html' WHERE id=?",
                                        file))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM flyway_schema_history WHERE version='23' AND success",
                                Integer.class))
                .isEqualTo(1);
    }

    private UUID binding(JdbcTemplate jdbc, UUID resident, UUID guardian, String exitStatus, String status) {
        UUID exit = UUID.randomUUID(), document = UUID.randomUUID(), binding = UUID.randomUUID();
        boolean approved = "APROVADA".equals(exitStatus);
        // A single statement, because the request and its first document reference each other.
        jdbc.update(
                """
                WITH created AS (
                    INSERT INTO sager_long_exit(id,resident_id,resident_name,enrollment,guardian_id,guardian_name,
                        guardian_relationship,departure_mode,requested_departure_at,expected_return_at,reason,status,
                        current_document_version_id,decision,decided_at,created_at,updated_at)
                    VALUES (?,?,'Residente Sintético','MIG',?,'Responsável sintético','Mãe','NOW',?,?,'Motivo sintético',?,?,?,?,?,?)
                )
                INSERT INTO sager_document_version(id,exit_id,revision_number,template_version,snapshot,original_file_id,
                    original_hash,original_size,original_state,created_at)
                VALUES (?,?,1,'SAGER-SAIDA-LONGA-v1','{}'::jsonb,?,repeat('d',64),10,'STORED',?)
                """,
                exit,
                resident,
                guardian,
                NOW,
                NOW.plusHours(5),
                exitStatus,
                document,
                approved ? "APPROVE" : null,
                approved ? NOW : null,
                NOW,
                NOW,
                document,
                exit,
                UUID.randomUUID(),
                NOW);
        boolean valid = "VALID".equals(status);
        jdbc.update(
                """
                INSERT INTO sager_signature_binding(id,exit_id,document_version_id,guardian_id,guardian_version,guardian_name,
                    guardian_relationship,guardian_phone,provider,environment,status,stage,expires_at,signed_at,verified_at,
                    verified_api,evidence_hash,created_at)
                VALUES (?,?,?,?,0,'Responsável sintético','Mãe','+5562999990000','CLICKSIGN','sandbox',?,?,?,?,?,?,?,?)
                """,
                binding,
                exit,
                document,
                guardian,
                status,
                valid ? "DONE" : "ENVELOPE",
                NOW.plusHours(24),
                valid ? NOW : null,
                valid ? NOW : null,
                valid,
                valid ? "a".repeat(64) : null,
                NOW);
        return binding;
    }

    private UUID task(JdbcTemplate jdbc, UUID binding, String type, String state) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO sager_integration_task(id,binding_id,type,state,idempotency_key,next_attempt_at,lease_until,
                    created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,
                id,
                binding,
                type,
                state,
                type + ":" + binding,
                NOW,
                "RUNNING".equals(state) ? NOW.plusMinutes(5) : null,
                NOW,
                NOW);
        return id;
    }

    private String status(JdbcTemplate jdbc, UUID binding) {
        return jdbc.queryForObject(
                "SELECT status FROM sager_signature_binding WHERE id=?", String.class, binding);
    }

    private String taskState(JdbcTemplate jdbc, UUID task) {
        return jdbc.queryForObject(
                "SELECT state FROM sager_integration_task WHERE id=?", String.class, task);
    }

    private void migrate(String schema, String version) {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas(schema)
                .defaultSchema(schema)
                .locations("classpath:db/migration")
                .target(version)
                .load()
                .migrate();
    }

    private JdbcTemplate jdbc(String schema) {
        String separator = POSTGRES.getJdbcUrl().contains("?") ? "&" : "?";
        return new JdbcTemplate(
                new DriverManagerDataSource(
                        POSTGRES.getJdbcUrl() + separator + "currentSchema=" + schema,
                        POSTGRES.getUsername(),
                        POSTGRES.getPassword()));
    }
}
