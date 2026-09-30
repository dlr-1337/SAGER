package br.edu.ifgoiano.sager.operations.longexits;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
@Profile({ "local", "production" })
public class LongExitGuardians {
    private final JdbcTemplate jdbc;

    public LongExitGuardians(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Guardian> list(UUID residentId) {
        return jdbc.query(
                "SELECT * FROM sager_guardian WHERE resident_id=? ORDER BY name,id",
                (r, n) ->
                        guardian(
                                r.getObject("id", UUID.class),
                                r.getString("name"),
                                r.getString("relationship"),
                                r.getString("phone"),
                                r.getBoolean("active"),
                                r.getLong("version")),
                residentId);
    }

    public Guardian require(UUID residentId, UUID guardianId) {
        Guardian guardian =
                jdbc
                        .query(
                                "SELECT * FROM sager_guardian WHERE id=? AND resident_id=? FOR"
                                        + " UPDATE",
                                (r, n) ->
                                        guardian(
                                                r.getObject("id", UUID.class),
                                                r.getString("name"),
                                                r.getString("relationship"),
                                                r.getString("phone"),
                                                r.getBoolean("active"),
                                                r.getLong("version")),
                                guardianId,
                                residentId)
                        .stream()
                        .findFirst()
                        .orElse(null);
        if (guardian == null || !guardian.eligible())
            throw new LongExitApiException(
                    HttpStatus.CONFLICT,
                    "guardian_not_eligible",
                    "Selecione um responsável ativo e vinculado com telefone brasileiro em E.164.");
        return guardian;
    }

    private Guardian guardian(
            UUID id, String name, String relationship, String phone, boolean active, long version) {
        List<String> blockers = new ArrayList<>();
        if (!active) blockers.add("guardian_inactive");
        if (phone == null || !phone.matches("\\+55[1-9][0-9]{9,10}"))
            blockers.add("brazilian_e164_required");
        return new Guardian(
                id, name, relationship, phone, blockers.isEmpty(), List.copyOf(blockers), version);
    }

    public record Guardian(
            UUID id,
            String name,
            String relationship,
            String phone,
            boolean eligible,
            List<String> blockers,
            long version) {}
}
