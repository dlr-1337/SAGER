package br.edu.ifgoiano.sager.management.residents;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("local")
public class ResidentRepository {
    private static final String COLUMNS = "id, name, enrollment, birth_date, course, version";
    private final JdbcTemplate jdbc;

    public ResidentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Resident> findAll() {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_resident ORDER BY name, id",
                (result, row) -> map(result));
    }

    public Optional<Resident> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_resident WHERE id = ?",
                (result, row) -> map(result), id).stream().findFirst();
    }

    public void insert(UUID id, String name, String enrollment, LocalDate birthDate,
            String course) {
        jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment, birth_date, course)
                VALUES (?, ?, ?, ?, ?)
                """, id, name, enrollment, birthDate, course);
    }

    public int update(UUID id, String name, String enrollment, LocalDate birthDate,
            String course, long version) {
        return jdbc.update("""
                UPDATE sager_resident
                SET name = ?, enrollment = ?, birth_date = ?, course = ?,
                    version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ?
                """, name, enrollment, birthDate, course, id, version);
    }

    private Resident map(ResultSet result) throws SQLException {
        return new Resident(result.getObject("id", UUID.class), result.getString("name"),
                result.getString("enrollment"), result.getObject("birth_date", LocalDate.class),
                result.getString("course"), result.getLong("version"));
    }
}
