package br.edu.ifgoiano.sager.audit;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile({ "local", "production" })
public class AuditRepository {
    private final JdbcTemplate jdbc;

    public AuditRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(AuditContextProvider.Context context, AuditResource resource,
            UUID resourceId, AuditAction action, long resultingVersion, List<String> changedFields) {
        insert("LOCAL_API", context.actorId(), context.actorProfile(), context.requestId(),
                resource, resourceId, action, resultingVersion, changedFields);
    }

    public void insertSystem(UUID requestId, AuditResource resource, UUID resourceId,
            AuditAction action, long resultingVersion, List<String> changedFields) {
        insert("SYSTEM_JOB", null, null, requestId, resource, resourceId, action,
                resultingVersion, changedFields);
    }

    private void insert(String origin, UUID actorId, String actorProfile, UUID requestId,
            AuditResource resource, UUID resourceId, AuditAction action, long resultingVersion,
            List<String> changedFields) {
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO sager_audit_event
                        (actor_id, actor_profile, origin, request_id, resource, resource_id,
                         action, resulting_version, changed_fields)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """);
            statement.setObject(1, actorId);
            statement.setString(2, actorProfile);
            statement.setString(3, origin);
            statement.setObject(4, requestId);
            statement.setString(5, resource.name());
            statement.setObject(6, resourceId);
            statement.setString(7, action.name());
            statement.setLong(8, resultingVersion);
            statement.setArray(9, connection.createArrayOf("text", changedFields.toArray(String[]::new)));
            return statement;
        });
    }

    public List<AuditEvent> find(UUID resourceId, UUID actorId, UUID requestId,
            AuditResource resource, Long beforeSequence, int fetchLimit) {
        StringBuilder sql = new StringBuilder("""
                SELECT * FROM sager_audit_event WHERE resource IN (
                    'SUPERVISOR','RESIDENT','COURSE','GUARDIAN','ACCOMMODATION','ACCOMMODATION_UNIT','ROOM','ALLOCATION',
                    'HEALTH_GRANT','CARE_ASSIGNMENT','HEALTH_CUSTODY',
                    'NIGHT_CALL','NIGHT_CALL_MARK','SHORT_EXIT',
                    'OCCURRENCE','DISCIPLINE_NOTIFICATION','WARNING','NOTICE','COMMUNICATION','COMMITMENT_TERM',
                    'CLEANING_ASSESSMENT','REPORT_SNAPSHOT','REPORT_EXPORT',
                    'LONG_EXIT','DOCUMENT_VERSION','SIGNATURE_BINDING','WHATSAPP_ATTEMPT','INTEGRATION_TASK'
                )
                """);
        List<Object> arguments = new ArrayList<>();
        addFilter(sql, arguments, "resource_id", resourceId);
        addFilter(sql, arguments, "actor_id", actorId);
        addFilter(sql, arguments, "request_id", requestId);
        addFilter(sql, arguments, "resource", resource == null ? null : resource.name());
        if (beforeSequence != null) {
            sql.append(" AND sequence < ?");
            arguments.add(beforeSequence);
        }
        sql.append(" ORDER BY sequence DESC LIMIT ?");
        arguments.add(fetchLimit);
        return jdbc.query(sql.toString(), this::map, arguments.toArray());
    }

    private void addFilter(StringBuilder sql, List<Object> arguments, String column, Object value) {
        if (value != null) {
            sql.append(" AND ").append(column).append(" = ?");
            arguments.add(value);
        }
    }

    private AuditEvent map(ResultSet row, int index) throws SQLException {
        var fields = row.getArray("changed_fields");
        try {
            return new AuditEvent(row.getLong("sequence"), row.getObject("id", UUID.class),
                    row.getObject("occurred_at", OffsetDateTime.class).toInstant(),
                    row.getObject("actor_id", UUID.class), row.getString("actor_profile"),
                    row.getString("origin"), row.getObject("request_id", UUID.class),
                    AuditResource.valueOf(row.getString("resource")),
                    row.getObject("resource_id", UUID.class), AuditAction.valueOf(row.getString("action")),
                    row.getLong("resulting_version"), List.of((String[]) fields.getArray()));
        } finally {
            fields.free();
        }
    }
}
