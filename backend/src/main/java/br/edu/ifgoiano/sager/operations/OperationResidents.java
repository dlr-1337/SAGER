package br.edu.ifgoiano.sager.operations;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("local")
public class OperationResidents {
    public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private final JdbcTemplate jdbc;

    public OperationResidents(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean lock(UUID id) {
        return !jdbc.query("SELECT id FROM sager_resident WHERE id = ? FOR UPDATE",
                (result, row) -> result.getObject(1, UUID.class), id).isEmpty();
    }

    public Eligibility eligibility(UUID id, Instant now) {
        ResidentInfo resident = jdbc.query("""
                SELECT r.id, r.name, r.enrollment, r.birth_date, q.id AS room_id,
                    q.number AS room_number, q.accommodation_id
                FROM sager_resident r
                LEFT JOIN sager_room_allocation a ON a.resident_id = r.id AND a.ended_at IS NULL
                LEFT JOIN sager_room q ON q.id = a.room_id
                WHERE r.id = ?
                """, (result, row) -> new ResidentInfo(result.getObject("id", UUID.class),
                result.getString("name"), result.getString("enrollment"),
                result.getObject("birth_date", LocalDate.class), result.getObject("room_id", UUID.class),
                result.getString("room_number"), result.getObject("accommodation_id", UUID.class)), id)
                .stream().findFirst().orElseThrow(OpsInput::notFound);
        LocalDate today = now.atZone(ZONE).toLocalDate();
        List<String> blockers = new ArrayList<>();
        if (resident.birthDate() == null) blockers.add("birth_date_required");
        else if (resident.birthDate().isAfter(today)
                || !resident.birthDate().plusYears(18).isAfter(today)) blockers.add("not_minor");
        if (resident.roomId() == null) blockers.add("active_allocation_required");
        return new Eligibility(resident.id(), resident.name(), resident.enrollment(), resident.birthDate(),
                resident.roomId(), resident.roomNumber(), resident.accommodationId(), blockers.isEmpty(),
                List.copyOf(blockers), today, now, ZONE.getId());
    }

    public record ResidentInfo(UUID id, String name, String enrollment, LocalDate birthDate,
            UUID roomId, String roomNumber, UUID accommodationId) {
    }

    public record Eligibility(UUID residentId, String residentName, String enrollment, LocalDate birthDate,
            UUID roomId, String roomNumber, UUID accommodationId, boolean eligible, List<String> blockers,
            LocalDate currentDate, Instant now, String zone) {
    }
}
