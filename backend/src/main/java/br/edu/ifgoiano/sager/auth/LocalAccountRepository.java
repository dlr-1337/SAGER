package br.edu.ifgoiano.sager.auth;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class LocalAccountRepository {
    private final JdbcTemplate jdbc;

    public LocalAccountRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<LocalAccount> findAll() { return query("ORDER BY profile, enrollment NULLS FIRST, id"); }

    public Optional<LocalAccount> findByEnrollment(String enrollment) {
        return query("WHERE lower(enrollment) = lower(?)", enrollment).stream().findFirst();
    }

    public Optional<LocalAccount> findForUpdate(String reference) {
        String checked = reference.strip();
        return query("WHERE lower(enrollment) = lower(?) OR email = ? FOR UPDATE", checked,
                checked.toLowerCase(java.util.Locale.ROOT)).stream().findFirst();
    }

    public Optional<LocalAccount> findByIdForUpdate(UUID id) {
        return query("WHERE id = ? FOR UPDATE", id).stream().findFirst();
    }

    public void assignEnrollment(LocalAccount account, String enrollment) {
        jdbc.update("UPDATE sager_local_account SET enrollment=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                enrollment, account.id());
        revokeSessions(account);
    }

    public void revokeSessions(LocalAccount account) {
        jdbc.update("DELETE FROM spring_session WHERE principal_name IN (?, ?)", account.id().toString(), account.email());
    }

    public Optional<LocalAccount> findByEmail(String email) {
        return query("WHERE email = ?", email).stream().findFirst();
    }

    public Optional<LocalAccount> findBySupervisorId(UUID id) {
        return query("WHERE supervisor_id = ? FOR UPDATE", id).stream().findFirst();
    }

    public Optional<LocalAccount> findByResidentId(UUID id) {
        return query("WHERE resident_id = ? FOR UPDATE", id).stream().findFirst();
    }

    public Optional<LocalAccount> findById(UUID id) {
        return query("WHERE id = ?", id).stream().findFirst();
    }

    public Optional<LocalAccount> findByEmailForUpdate(String email) {
        return query("WHERE email = ? FOR UPDATE", email).stream().findFirst();
    }

    public boolean residentExists(UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM sager_resident WHERE id = ?)", Boolean.class, id));
    }

    public boolean supervisorExists(UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM sager_supervisor WHERE id = ?)", Boolean.class, id));
    }

    public void updateLink(LocalAccount account, UUID residentId, UUID supervisorId) {
        jdbc.update("""
                UPDATE sager_local_account
                SET resident_id = ?, supervisor_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, residentId, supervisorId, account.id());
        revokeSessions(account);
    }

    public void create(String enrollment, String email, String name, String passwordHash, String profile) {
        jdbc.update("""
                INSERT INTO sager_local_account
                    (id, enrollment, email, display_name, password_hash, profile, active)
                VALUES (?, ?, ?, ?, ?, ?, true)
                """, UUID.randomUUID(), enrollment, email, name, passwordHash, profile);
    }

    public int updatePassword(LocalAccount account, String passwordHash) {
        int changed = jdbc.update("""
                UPDATE sager_local_account SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND active = true
                """, passwordHash, account.id());
        if (changed > 0) revokeSessions(account);
        return changed;
    }

    public int disable(LocalAccount account) {
        int changed = jdbc.update("""
                UPDATE sager_local_account SET active = false, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND active = true
                """, account.id());
        if (changed > 0) revokeSessions(account);
        return changed;
    }

    private List<LocalAccount> query(String condition, Object... arguments) {
        return jdbc.query("""
                SELECT id, email, display_name, password_hash, profile, active, resident_id, supervisor_id, enrollment
                FROM sager_local_account
                """ + condition, (result, row) -> new LocalAccount(
                result.getObject("id", UUID.class), result.getString("email"),
                result.getString("display_name"), result.getString("password_hash"),
                result.getString("profile"), result.getBoolean("active"),
                result.getObject("resident_id", UUID.class),
                result.getObject("supervisor_id", UUID.class), result.getString("enrollment")), arguments);
    }
}
