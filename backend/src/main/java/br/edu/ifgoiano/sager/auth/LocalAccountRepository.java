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

    public Optional<LocalAccount> findByEmail(String email) {
        return query("WHERE email = ?", email).stream().findFirst();
    }

    public Optional<LocalAccount> findById(UUID id) {
        return query("WHERE id = ?", id).stream().findFirst();
    }

    public void create(String email, String name, String passwordHash, String profile) {
        jdbc.update("""
                INSERT INTO sager_local_account
                    (id, email, display_name, password_hash, profile, active)
                VALUES (?, ?, ?, ?, ?, true)
                """, UUID.randomUUID(), email, name, passwordHash, profile);
    }

    public int updatePassword(String email, String passwordHash) {
        int changed = jdbc.update("""
                UPDATE sager_local_account SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
                WHERE email = ? AND active = true
                """, passwordHash, email);
        if (changed > 0) {
            jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", email);
        }
        return changed;
    }

    public int disable(String email) {
        int changed = jdbc.update("""
                UPDATE sager_local_account SET active = false, updated_at = CURRENT_TIMESTAMP
                WHERE email = ? AND active = true
                """, email);
        if (changed > 0) {
            jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", email);
        }
        return changed;
    }

    private List<LocalAccount> query(String condition, Object argument) {
        return jdbc.query("""
                SELECT id, email, display_name, password_hash, profile, active
                FROM sager_local_account
                """ + condition, (result, row) -> new LocalAccount(
                result.getObject("id", UUID.class), result.getString("email"),
                result.getString("display_name"), result.getString("password_hash"),
                result.getString("profile"), result.getBoolean("active")), argument);
    }
}
