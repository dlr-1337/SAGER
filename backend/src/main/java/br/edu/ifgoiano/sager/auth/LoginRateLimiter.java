package br.edu.ifgoiano.sager.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({"local", "production"})
public class LoginRateLimiter {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final byte[] secret;
    public LoginRateLimiter(JdbcTemplate jdbc, Clock clock, @Value("${sager.production.rate-limit-secret:}") String secret) {
        this.jdbc = jdbc; this.clock = clock; this.secret = (secret.isBlank() ? java.util.UUID.randomUUID().toString() : secret).getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public boolean allow(String email, String address) {
        return consume(key("IP", address), 1000) && consume(key("ENROLLMENT", normalize(email)), 5);
    }

    @Transactional
    public boolean allowRecovery(String enrollment, String address) {
        // Login success never resets recovery throttling.
        boolean ip = consume(key("RECOVERY_IP", address), 20);
        boolean account = consume(key("RECOVERY_ENROLLMENT", normalize(enrollment)), 5);
        return ip && account;
    }

    @Transactional
    public void succeeded(String email) { jdbc.update("DELETE FROM sager_login_rate_bucket WHERE key_hash=?", key("ENROLLMENT", normalize(email))); }

    @Scheduled(fixedDelayString = "${sager.production.login-counter-cleanup-ms:3600000}")
    @Transactional
    public void cleanup() {
        jdbc.update("DELETE FROM sager_login_rate_bucket WHERE window_started_at<?", now().minusDays(2));
    }

    private boolean consume(String key, int limit) {
        Integer count = jdbc.queryForObject("""
                INSERT INTO sager_login_rate_bucket(key_hash,window_started_at,attempts) VALUES (?,?,1)
                ON CONFLICT(key_hash) DO UPDATE SET
                    attempts=CASE WHEN sager_login_rate_bucket.window_started_at<=EXCLUDED.window_started_at-INTERVAL '15 minutes'
                        THEN 1 ELSE LEAST(sager_login_rate_bucket.attempts+1,2000000) END,
                    window_started_at=CASE WHEN sager_login_rate_bucket.window_started_at<=EXCLUDED.window_started_at-INTERVAL '15 minutes'
                        THEN EXCLUDED.window_started_at ELSE sager_login_rate_bucket.window_started_at END
                RETURNING attempts
                """, Integer.class, key, now());
        return count != null && count <= limit;
    }

    private OffsetDateTime now() { return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC); }
    private String normalize(String email) { return email == null ? "" : email.trim().toLowerCase(Locale.ROOT); }
    private String key(String type, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((type + ":" + value).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException error) {
            throw new IllegalStateException("Login protection unavailable.");
        }
    }
}
