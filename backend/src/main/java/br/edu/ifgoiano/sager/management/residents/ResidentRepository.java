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
@Profile({ "local", "production" })
public class ResidentRepository {
    private static final String COLUMNS = "id, name, enrollment, birth_date, COALESCE((SELECT c.name FROM sager_course c WHERE c.id=sager_resident.course_id),course) AS course, version, course_id, institutional_email";
    private final JdbcTemplate jdbc;

    public ResidentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<Resident> search(java.util.Map<String,String> params) {
        return br.edu.ifgoiano.sager.management.ManagementSearch.query(jdbc, COLUMNS, "sager_resident",
                "concat_ws(' ', name,enrollment,institutional_email,COALESCE((SELECT c.name FROM sager_course c WHERE c.id=sager_resident.course_id),course))", "enrollment", "sager_search_text(name), id", java.util.Map.of("courseId", "course_id = ?::uuid", "roomId", "EXISTS (SELECT 1 FROM sager_room_allocation a WHERE a.resident_id=sager_resident.id AND a.ended_at IS NULL AND a.room_id=?::uuid)", "accommodationId", "EXISTS (SELECT 1 FROM sager_room_allocation a JOIN sager_room q ON q.id=a.room_id WHERE a.resident_id=sager_resident.id AND a.ended_at IS NULL AND q.accommodation_id=?::uuid)", "allocated", "EXISTS (SELECT 1 FROM sager_room_allocation a WHERE a.resident_id=sager_resident.id AND a.ended_at IS NULL) = ?::boolean"), params, (r,n) -> map(r));
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
            String course, UUID courseId, String institutionalEmail) {
        jdbc.update("""
                INSERT INTO sager_resident (id, name, enrollment, birth_date, course, course_id, institutional_email)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, name, enrollment, birthDate, course, courseId, institutionalEmail);
    }

    public int update(UUID id, String name, String enrollment, LocalDate birthDate,
            String course, UUID courseId, String institutionalEmail, long version) {
        return jdbc.update("""
                UPDATE sager_resident
                SET name = ?, enrollment = ?, birth_date = ?, course = ?, course_id = ?, institutional_email = ?,
                    version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ?
                """, name, enrollment, birthDate, course, courseId, institutionalEmail, id, version);
    }

    private Resident map(ResultSet result) throws SQLException {
        return new Resident(result.getObject("id", UUID.class), result.getString("name"),
                result.getString("enrollment"), result.getObject("birth_date", LocalDate.class),
                result.getString("course"), result.getLong("version"), result.getObject("course_id", UUID.class), result.getString("institutional_email"));
    }
}
