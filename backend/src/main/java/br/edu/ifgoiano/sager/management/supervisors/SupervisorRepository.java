package br.edu.ifgoiano.sager.management.supervisors;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile({ "local", "production" })
public class SupervisorRepository {
    private static final String COLUMNS = "id, name, institutional_id, email, version";

    private final JdbcTemplate jdbc;

    public SupervisorRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<Supervisor> search(java.util.Map<String,String> params) {
        return br.edu.ifgoiano.sager.management.ManagementSearch.query(jdbc, COLUMNS, "sager_supervisor",
                "concat_ws(' ',name,institutional_id,email)", "institutional_id", "sager_search_text(name), id", java.util.Map.of(), params, (r,n) -> map(r));
    }

    public List<Supervisor> findAll() {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_supervisor ORDER BY name, id",
                (result, row) -> map(result));
    }

    public Optional<Supervisor> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_supervisor WHERE id = ?",
                (result, row) -> map(result), id).stream().findFirst();
    }

    public void insert(UUID id, String name, String institutionalId, String email) {
        jdbc.update("""
                INSERT INTO sager_supervisor (id, name, institutional_id, email)
                VALUES (?, ?, ?, ?)
                """, id, name, institutionalId, email);
    }

    public int update(UUID id, String name, String institutionalId, String email, long version) {
        return jdbc.update("""
                UPDATE sager_supervisor
                SET name = ?, institutional_id = ?, email = ?, version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ?
                """, name, institutionalId, email, id, version);
    }

    private Supervisor map(java.sql.ResultSet result) throws java.sql.SQLException {
        return new Supervisor(result.getObject("id", UUID.class), result.getString("name"),
                result.getString("institutional_id"), result.getString("email"),
                result.getLong("version"));
    }
}
