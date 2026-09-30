package br.edu.ifgoiano.sager.management.accommodations;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile({ "local", "production" })
public class AccommodationRepository {
    private static final String COLUMNS = "id, code, name, version";
    private static final String UNIT_COLUMNS = "id, accommodation_id, code, name, version";
    private final JdbcTemplate jdbc;

    public AccommodationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Accommodation> findAll() {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_accommodation ORDER BY name, code, id",
                (result, row) -> map(result));
    }

    public Optional<Accommodation> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_accommodation WHERE id = ?",
                (result, row) -> map(result), id).stream().findFirst();
    }

    public void insert(UUID id, String code, String name) {
        jdbc.update("INSERT INTO sager_accommodation (id, code, name) VALUES (?, ?, ?)", id, code, name);
    }

    public int update(UUID id, String code, String name, long version) {
        return jdbc.update("""
                UPDATE sager_accommodation
                SET code = ?, name = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ?
                """, code, name, id, version);
    }

    public List<AccommodationUnit> findAllUnits() {
        return jdbc.query("SELECT " + UNIT_COLUMNS
                + " FROM sager_accommodation_unit ORDER BY accommodation_id, name, code, id",
                (result, row) -> mapUnit(result));
    }

    public List<AccommodationUnit> findUnits(UUID accommodationId) {
        return jdbc.query("SELECT " + UNIT_COLUMNS
                + " FROM sager_accommodation_unit WHERE accommodation_id = ? ORDER BY name, code, id",
                (result, row) -> mapUnit(result), accommodationId);
    }

    public Optional<AccommodationUnit> findUnit(UUID accommodationId, UUID unitId) {
        return jdbc.query("SELECT " + UNIT_COLUMNS
                + " FROM sager_accommodation_unit WHERE id = ? AND accommodation_id = ?",
                (result, row) -> mapUnit(result), unitId, accommodationId).stream().findFirst();
    }

    public void insertUnit(UUID id, UUID accommodationId, String code, String name) {
        jdbc.update("""
                INSERT INTO sager_accommodation_unit (id, accommodation_id, code, name)
                VALUES (?, ?, ?, ?)
                """, id, accommodationId, code, name);
    }

    public int updateUnit(UUID id, UUID accommodationId, String code, String name, long version) {
        return jdbc.update("""
                UPDATE sager_accommodation_unit
                SET code = ?, name = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND accommodation_id = ? AND version = ?
                """, code, name, id, accommodationId, version);
    }

    private Accommodation map(ResultSet result) throws SQLException {
        return new Accommodation(result.getObject("id", UUID.class), result.getString("code"),
                result.getString("name"), result.getLong("version"));
    }

    private AccommodationUnit mapUnit(ResultSet result) throws SQLException {
        return new AccommodationUnit(result.getObject("id", UUID.class),
                result.getObject("accommodation_id", UUID.class), result.getString("code"),
                result.getString("name"), result.getLong("version"));
    }
}
