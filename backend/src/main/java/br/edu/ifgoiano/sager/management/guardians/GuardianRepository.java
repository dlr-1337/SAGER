package br.edu.ifgoiano.sager.management.guardians;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("local")
public class GuardianRepository {
    private static final String COLUMNS = "id, resident_id, name, relationship, phone, active, version";
    private final JdbcTemplate jdbc;

    public GuardianRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Guardian> findAll() {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_guardian ORDER BY name, id",
                (result, row) -> map(result));
    }

    public Optional<Guardian> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_guardian WHERE id = ?",
                (result, row) -> map(result), id).stream().findFirst();
    }

    public boolean residentExists(UUID residentId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM sager_resident WHERE id = ?)", Boolean.class,
                residentId));
    }

    public void insert(UUID id, UUID residentId, String name, String relationship,
            String phone, boolean active) {
        jdbc.update("""
                INSERT INTO sager_guardian (id, resident_id, name, relationship, phone, active)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, residentId, name, relationship, phone, active);
    }

    public int update(UUID id, UUID residentId, String name, String relationship,
            String phone, boolean active, long version) {
        return jdbc.update("""
                UPDATE sager_guardian
                SET resident_id = ?, name = ?, relationship = ?, phone = ?, active = ?,
                    version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ?
                """, residentId, name, relationship, phone, active, id, version);
    }

    private Guardian map(ResultSet result) throws SQLException {
        return new Guardian(result.getObject("id", UUID.class),
                result.getObject("resident_id", UUID.class), result.getString("name"),
                result.getString("relationship"), result.getString("phone"),
                result.getBoolean("active"), result.getLong("version"));
    }
}
