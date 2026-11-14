package br.edu.ifgoiano.sager.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.auth.LocalAccountPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(webEnvironment = WebEnvironment.NONE)
@ActiveProfiles("local")
class AuditServiceIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private AuditService audit;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @AfterEach
    void clearThreadContexts() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void internalTaskRecordsItsCorrelationWithNoFabricatedHumanActor() {
        UUID resource = UUID.randomUUID();
        UUID correlation = UUID.randomUUID();
        transaction().executeWithoutResult(status -> audit.recordSystem(correlation,
                AuditResource.SHORT_EXIT, resource, AuditAction.UPDATE, 1, Set.of("status", "expiryReason")));
        Map<String, Object> event = jdbc.queryForMap("SELECT * FROM sager_audit_event WHERE resource_id = ?", resource);
        assertThat(event).containsEntry("request_id", correlation).containsEntry("origin", "SYSTEM_JOB")
                .containsEntry("actor_id", null).containsEntry("actor_profile", null);
    }

    @Test
    void systemAuditRejectsHttpContextAndMissingCorrelation() {
        UUID resource = UUID.randomUUID();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.recordSystem(null,
                AuditResource.SHORT_EXIT, resource, AuditAction.UPDATE, 1, Set.of("status"))))
                .isInstanceOf(IllegalStateException.class);
        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.recordSystem(UUID.randomUUID(),
                AuditResource.SHORT_EXIT, resource, AuditAction.UPDATE, 1, Set.of("status"))))
                .isInstanceOf(IllegalStateException.class);
        assertNoWrites(resource);
    }

    @Test
    void internalTaskRequiresDomainTransactionAndRollsBackItsEvent() {
        UUID resource = UUID.randomUUID();
        UUID correlation = UUID.randomUUID();
        assertThatThrownBy(() -> audit.recordSystem(correlation, AuditResource.SHORT_EXIT, resource,
                AuditAction.UPDATE, 1, Set.of("status")))
                .isInstanceOf(IllegalTransactionStateException.class);
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> {
            supervisor(resource);
            audit.recordSystem(correlation, AuditResource.SHORT_EXIT, resource,
                    AuditAction.UPDATE, 1, Set.of("status"));
            throw new IllegalStateException("synthetic batch failure");
        })).isInstanceOf(IllegalStateException.class);
        assertNoWrites(resource);
    }

    @Test
    void recordUsesAuthenticatedPrincipalAndRequestMetadataWithOnlyAllowedFieldNames() {
        UUID actor = UUID.randomUUID();
        UUID request = UUID.randomUUID();
        authenticatedRequest(actor, request);
        Map<AuditResource, Set<String>> fieldCases = Map.of(
                AuditResource.SUPERVISOR, Set.of("name", "institutionalId", "email"),
                AuditResource.RESIDENT, Set.of("name", "enrollment", "birthDate", "course"),
                AuditResource.GUARDIAN, Set.of("residentId", "name", "relationship", "phone", "active"),
                AuditResource.ACCOMMODATION, Set.of("code", "name"),
                AuditResource.ACCOMMODATION_UNIT, Set.of("accommodationId", "code", "name"),
                AuditResource.ROOM, Set.of("code", "number", "accommodationId", "unitId", "floor",
                        "capacity", "situation"),
                AuditResource.ALLOCATION, Set.of("residentId", "roomId", "startedAt", "endedAt", "endReason"));
        for (var fieldCase : fieldCases.entrySet()) {
            AuditResource resource = fieldCase.getKey();
            UUID resourceId = UUID.randomUUID();
            transaction().executeWithoutResult(status -> audit.record(resource, resourceId,
                    AuditAction.CREATE, 0, fieldCase.getValue()));
            var row = jdbc.queryForMap("SELECT * FROM sager_audit_event WHERE resource_id = ?",
                    resourceId);
            assertThat(row).containsEntry("actor_id", actor).containsEntry("actor_profile", "gestor")
                    .containsEntry("origin", "LOCAL_API").containsEntry("request_id", request)
                    .containsEntry("resource", resource.name()).containsEntry("action", "CREATE")
                    .containsEntry("resulting_version", 0L);
            assertThat(row.get("id")).isInstanceOf(UUID.class);
            assertThat(row.get("occurred_at")).isNotNull();
            List<String> fields = jdbc.queryForObject(
                    "SELECT changed_fields FROM sager_audit_event WHERE resource_id = ?",
                    (rs, index) -> List.of((String[]) rs.getArray(1).getArray()), resourceId);
            assertThat(fields).containsExactlyInAnyOrderElementsOf(fieldCase.getValue());
            assertThat(fields).isSorted();
        }
    }

    @Test
    void rollbackDiscardsTheDomainWriteAndItsAuditEventTogether() {
        UUID resource = UUID.randomUUID();
        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> {
            supervisor(resource);
            audit.record(AuditResource.SUPERVISOR, resource, AuditAction.CREATE, 0, Set.of("name"));
            throw new IllegalStateException("synthetic downstream failure");
        })).isInstanceOf(IllegalStateException.class);
        assertNoWrites(resource);
    }

    @Test
    void noTransactionCannotCreateAnIndependentAuditEvent() {
        UUID resource = UUID.randomUUID();
        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        assertThatThrownBy(() -> audit.record(AuditResource.SUPERVISOR, resource,
                AuditAction.CREATE, 0, Set.of("name")))
                .isInstanceOf(IllegalTransactionStateException.class);
        assertNoWrites(resource);
    }

    @Test
    void absentAuthenticatedContextRollsBackMutationRatherThanFabricatingAnActor() {
        UUID resource = UUID.randomUUID();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> {
            supervisor(resource);
            audit.record(AuditResource.SUPERVISOR, resource, AuditAction.CREATE, 0, Set.of("name"));
        })).isInstanceOf(IllegalStateException.class);
        assertNoWrites(resource);

        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        RequestContextHolder.resetRequestAttributes();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.record(
                AuditResource.SUPERVISOR, resource, AuditAction.CREATE, 0, Set.of("name"))))
                .isInstanceOf(IllegalStateException.class);
        assertNoWrites(resource);
    }

    @Test
    void untrustedPrincipalAndCallerHeaderCannotSubstituteAuthenticatedRequestContext() {
        UUID resource = UUID.randomUUID();
        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("caller@example.invalid", null,
                        List.of(new SimpleGrantedAuthority("ROLE_GESTOR"))));
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.record(
                AuditResource.SUPERVISOR, resource, AuditAction.CREATE, 0, Set.of("name"))))
                .isInstanceOf(IllegalStateException.class);

        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Request-Id", UUID.randomUUID().toString());
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.record(
                AuditResource.SUPERVISOR, resource, AuditAction.CREATE, 0, Set.of("name"))))
                .isInstanceOf(IllegalStateException.class);
        assertNoWrites(resource);
    }

    @Test
    void valuesAndUnknownFieldsCannotEnterThePermanentRecord() {
        UUID resource = UUID.randomUUID();
        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        for (Set<String> fields : List.of(Set.of("Pessoa Sintética"), Set.of("password"),
                Set.of("enrollment"))) {
            assertThatThrownBy(() -> transaction().executeWithoutResult(status -> {
                supervisor(resource);
                audit.record(AuditResource.SUPERVISOR, resource, AuditAction.CREATE, 0, fields);
            })).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageNotContaining("Pessoa Sintética").hasMessageNotContaining("password");
            assertNoWrites(resource);
        }
    }

    @Test
    void accountAuditRecordsOperatorWithoutActorAndRecoveryWithTheAccountAndRequest() {
        UUID account = UUID.randomUUID();
        UUID correlation = UUID.randomUUID();
        transaction().executeWithoutResult(status -> audit.recordOperator(correlation, account,
                AuditAction.CREATE, Set.of("profile", "enrollment", "password")));
        assertThat(jdbc.queryForMap("SELECT * FROM sager_audit_event WHERE resource_id = ?", account))
                .containsEntry("origin", "OPERATOR_CLI").containsEntry("actor_id", null)
                .containsEntry("actor_profile", null).containsEntry("request_id", correlation)
                .containsEntry("resource", "LOCAL_ACCOUNT").containsEntry("resulting_version", 0L);

        UUID resident = UUID.randomUUID();
        UUID request = UUID.randomUUID();
        MockHttpServletRequest http = new MockHttpServletRequest();
        http.setAttribute(AuditContextProvider.REQUEST_ID_ATTRIBUTE, request);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(http));
        transaction().executeWithoutResult(status -> audit.recordAccount(resident, "residente",
                AuditAction.UPDATE, Set.of("password")));
        assertThat(jdbc.queryForMap("SELECT * FROM sager_audit_event WHERE resource_id = ?", resident))
                .containsEntry("origin", "LOCAL_API").containsEntry("actor_id", resident)
                .containsEntry("actor_profile", "residente").containsEntry("request_id", request)
                .containsEntry("action", "UPDATE");
    }

    @Test
    void accountAuditRejectsOperatorInsideRequestAndRecoveryWithoutCorrelation() {
        UUID account = UUID.randomUUID();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.recordAccount(
                account, "residente", AuditAction.UPDATE, Set.of("password"))))
                .isInstanceOf(IllegalStateException.class);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.recordAccount(
                account, "residente", AuditAction.UPDATE, Set.of("password"))))
                .isInstanceOf(IllegalStateException.class);

        authenticatedRequest(UUID.randomUUID(), UUID.randomUUID());
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.recordOperator(
                UUID.randomUUID(), account, AuditAction.CREATE, Set.of("name"))))
                .isInstanceOf(IllegalStateException.class);
        RequestContextHolder.resetRequestAttributes();
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.recordOperator(
                null, account, AuditAction.CREATE, Set.of("name"))))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> transaction().executeWithoutResult(status -> audit.recordOperator(
                UUID.randomUUID(), account, AuditAction.UPDATE, Set.of("passwordHash"))))
                .isInstanceOf(IllegalArgumentException.class);
        assertNoWrites(account);
    }

    private void supervisor(UUID id) {
        jdbc.update("""
                INSERT INTO sager_supervisor (id, name, institutional_id, email)
                VALUES (?, 'Pessoa Sintética', ?, 'fixture@example.invalid')
                """, id, "DEMO-" + id);
    }

    private void assertNoWrites(UUID resource) {
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_supervisor WHERE id = ?",
                Integer.class, resource)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_audit_event WHERE resource_id = ?",
                Integer.class, resource)).isZero();
    }

    private void authenticatedRequest(UUID actor, UUID correlation) {
        var principal = new LocalAccountPrincipal(actor, "actor@example.invalid", "Ator Sintético",
                "gestor", null, null, "actor");
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null,
                        List.of(new SimpleGrantedAuthority("ROLE_GESTOR"))));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(AuditContextProvider.REQUEST_ID_ATTRIBUTE, correlation);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private TransactionTemplate transaction() {
        return new TransactionTemplate(transactionManager);
    }
}
