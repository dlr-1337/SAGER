package br.edu.ifgoiano.sager.pending;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import br.edu.ifgoiano.sager.api.ApiErrors;
import br.edu.ifgoiano.sager.discipline.DisciplineActor;
import br.edu.ifgoiano.sager.discipline.DisciplineApiException;
import com.fasterxml.jackson.annotation.JsonInclude;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Counts what waits for the signed-in person, for the menu badges. Only reads: it never marks a
 * record as seen. Each count follows the same rule as the action it points to (pending-badges).
 */
@Service
@Profile({ "local", "production" })
public class PendingService {
    /** Pending analysis inside the deadline, or approved with the requested departure reached. */
    private static final String EXITS_WAITING = """
            (e.status = 'AGUARDANDO_ANALISE'
                AND CASE WHEN e.departure_mode = 'SCHEDULED' THEN e.requested_departure_at
                    ELSE e.expected_return_at END > t.now)
            OR (e.status = 'APROVADA' AND e.requested_departure_at <= t.now AND e.expected_return_at > t.now)
            """;
    private static final String SUPERVISOR = """
            WITH t AS (SELECT CAST(? AS TIMESTAMPTZ) AS now)
            SELECT
                (SELECT COUNT(*) FROM sager_short_exit e CROSS JOIN t WHERE %1$s) AS short_exits,
                (SELECT COUNT(*) FROM sager_long_exit e CROSS JOIN t WHERE %1$s) AS long_exits,
                (SELECT COUNT(*) FROM sager_discipline_notification n
                    JOIN sager_occurrence o ON o.id = n.occurrence_id
                    WHERE n.status IN ('PENDENTE', 'VISUALIZADA', 'EM_ANALISE')
                        OR (n.status = 'CONVERTIDA' AND n.requires_review AND o.valid)) AS notifications,
                (SELECT COUNT(*) FROM sager_night_call c WHERE c.status = 'ABERTA') AS night_calls,
                (SELECT COUNT(*) FROM sager_whatsapp_conversation c WHERE EXISTS (
                    SELECT 1 FROM sager_whatsapp_message m WHERE m.conversation_id = c.id
                        AND m.direction = 'IN' AND (c.read_at IS NULL OR m.received_at > c.read_at)))
                    AS conversations
            """.formatted(EXITS_WAITING);
    private static final String RESIDENT = """
            SELECT COUNT(*) FILTER (WHERE c.kind = 'AVISO') AS notices,
                COUNT(*) FILTER (WHERE c.kind = 'ADVERTENCIA') AS warnings,
                COUNT(*) FILTER (WHERE c.kind = 'TERMO') AS terms
            FROM sager_communication c
            JOIN sager_communication_recipient r ON r.communication_id = c.id
            WHERE r.resident_id = ? AND c.status = 'PUBLICADO' AND r.acknowledged_at IS NULL
            """;

    private final JdbcTemplate jdbc;
    private final DisciplineActor actor;
    private final Clock clock;

    public PendingService(JdbcTemplate jdbc, DisciplineActor actor, Clock clock) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Counts counts() {
        var account = actor.current();
        return switch (account.profile()) {
            case "supervisor" -> supervisor();
            case "residente" -> resident(account.residentId());
            // The manager's routine has nothing that waits for an action with a deadline.
            default -> throw new DisciplineApiException(HttpStatus.FORBIDDEN, "forbidden", ApiErrors.message(403));
        };
    }

    private Counts supervisor() {
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        return jdbc.queryForObject(SUPERVISOR, (rs, n) -> new Counts(rs.getLong("short_exits"),
                rs.getLong("long_exits"), rs.getLong("notifications"), rs.getLong("night_calls"),
                rs.getLong("conversations"), null, null, null), now);
    }

    private Counts resident(UUID residentId) {
        if (residentId == null)
            throw new DisciplineApiException(HttpStatus.FORBIDDEN, "resident_link_required",
                    "Conta de residente vinculada necessária.");
        return jdbc.queryForObject(RESIDENT, (rs, n) -> new Counts(null, null, null, null, null,
                rs.getLong("notices"), rs.getLong("warnings"), rs.getLong("terms")), residentId);
    }

    /**
     * One count per menu item or tab, only with the fields of the profile. Supervisor: exits split
     * by tab, notifications awaiting a decision or the confirmation of a corrected origin, open night
     * calls and conversations with unread messages. Resident: current notices, warnings and terms
     * still without acknowledgment.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Counts(Long shortExits, Long longExits, Long notifications, Long nightCalls,
            Long conversations, Long notices, Long warnings, Long terms) {
    }
}
