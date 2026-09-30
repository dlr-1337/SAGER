package br.edu.ifgoiano.sager.discipline;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
@Profile({ "local", "production" })
public class DisciplineIdempotency {
    private final JdbcTemplate jdbc;
    public DisciplineIdempotency(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public UUID replay(UUID actor,String action,UUID key,JsonNode payload) {
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",actor+":"+action+":"+key);
        var rows=jdbc.queryForList("SELECT payload_hash,resource_id FROM sager_discipline_idempotency WHERE actor_id=? AND action=? AND key=?",actor,action,key);
        if(rows.isEmpty()) return null;
        if(!hash(canonical(payload)).equals(rows.getFirst().get("payload_hash")))
            throw DisciplineInput.conflict("idempotency_mismatch","A chave já foi usada com conteúdo diferente.");
        return (UUID) rows.getFirst().get("resource_id");
    }
    public void remember(UUID actor,String action,UUID key,JsonNode payload,UUID id,OffsetDateTime now) {
        jdbc.update("INSERT INTO sager_discipline_idempotency(actor_id,action,key,payload_hash,resource_id,created_at) VALUES (?,?,?,?,?,?)",actor,action,key,hash(canonical(payload)),id,now);
    }
    public static String hash(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    private String canonical(JsonNode node) {
        if(node.isObject()) {
            TreeMap<String,String> map=new TreeMap<>();
            for(var entry:node.properties()) map.put(entry.getKey(),canonical(entry.getValue()));
            StringBuilder result=new StringBuilder("{");boolean first=true;
            for(var entry:map.entrySet()) {
                if(!first) result.append(',');first=false;
                result.append(tools.jackson.databind.node.JsonNodeFactory.instance.stringNode(entry.getKey())).append(':').append(entry.getValue());
            }
            return result.append('}').toString();
        }
        if(node.isArray()) {
            StringBuilder result=new StringBuilder("["); for(var item:node) result.append(canonical(item)).append(',');
            return result.append(']').toString();
        }
        return node.toString();
    }
}
