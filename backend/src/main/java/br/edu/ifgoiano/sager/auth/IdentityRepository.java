package br.edu.ifgoiano.sager.auth;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class IdentityRepository {
    private final JdbcTemplate jdbc;

    public IdentityRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public LocalIdentity findOrCreate(String issuer, String subject) {
        jdbc.update("""
                INSERT INTO sager_identity (id, issuer, subject, active)
                VALUES (?, ?, ?, true)
                ON CONFLICT (issuer, subject) DO NOTHING
                """, UUID.randomUUID(), issuer, subject);
        return find(issuer, subject).orElseThrow();
    }

    public Optional<LocalIdentity> find(String issuer, String subject) {
        List<LocalIdentity> identities = jdbc.query("""
                SELECT id, active FROM sager_identity
                WHERE issuer = ? AND subject = ?
                """, (result, row) -> {
                    UUID id = result.getObject("id", UUID.class);
                    return new LocalIdentity(id, result.getBoolean("active"), profilesFor(id));
                }, issuer, subject);
        return identities.stream().findFirst();
    }

    private List<String> profilesFor(UUID identityId) {
        return jdbc.queryForList("""
                SELECT profile FROM sager_identity_profile
                WHERE identity_id = ? ORDER BY profile
                """, String.class, identityId);
    }
}
