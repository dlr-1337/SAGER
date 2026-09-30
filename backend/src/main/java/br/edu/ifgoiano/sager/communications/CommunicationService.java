package br.edu.ifgoiano.sager.communications;

import static br.edu.ifgoiano.sager.communications.CommunicationModels.*;
import static br.edu.ifgoiano.sager.discipline.DisciplineInput.*;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import br.edu.ifgoiano.sager.audit.*;
import br.edu.ifgoiano.sager.discipline.*;
import br.edu.ifgoiano.sager.discipline.DisciplineModels.Page;
import br.edu.ifgoiano.sager.documents.StoredFile;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
@Profile("local")
public class CommunicationService {
    private final JdbcTemplate jdbc;
    private final DisciplineActor actor;
    private final DisciplineIdempotency keys;
    private final AuditService audit;
    private final Clock clock;
    public CommunicationService(JdbcTemplate jdbc,DisciplineActor actor,DisciplineIdempotency keys,AuditService audit,Clock clock) {
        this.jdbc=jdbc;this.actor=actor;this.keys=keys;this.audit=audit;this.clock=clock;
    }
    @Transactional(readOnly=true)
    public Page<Notice> notices(int limit,Long cursor) {
        actor.supervisor();limit(limit,cursor);
        var rows=jdbc.queryForList("SELECT id,sequence FROM sager_notice WHERE (?::bigint IS NULL OR sequence<?) ORDER BY sequence DESC LIMIT ?",cursor,cursor,limit+1);
        boolean more=rows.size()>limit;
        var selected=more?rows.subList(0,limit):rows;
        return new Page<>(selected.stream().map(row->notice((UUID)row.get("id"))).toList(),more?((Number)selected.getLast().get("sequence")).longValue():null);
    }
    @Transactional(readOnly=true)
    public Notice getNotice(UUID id) { actor.supervisor();return notice(id); }
    private Notice notice(UUID id) {
        var rows=jdbc.queryForList("SELECT n.*,c.id AS communication_id FROM sager_notice n LEFT JOIN LATERAL (SELECT id FROM sager_communication WHERE source_id=n.id AND kind='AVISO' ORDER BY content_version DESC LIMIT 1) c ON true WHERE n.id=?",id);
        if(rows.isEmpty()) throw missing();var row=rows.getFirst();
        List<UUID> residents=jdbc.query("SELECT resident_id FROM sager_notice_draft_recipient WHERE notice_id=? ORDER BY resident_id",(rs,n)->rs.getObject(1,UUID.class),id);
        return new Notice(id,(String)row.get("title"),(String)row.get("body"),residents,(String)row.get("status"),number(row,"version"),time(row.get("published_at")),(UUID)row.get("communication_id"),(String)row.get("withdrawal_reason"));
    }
    @Transactional
    public Notice createNotice(JsonNode body) {
        fields(body,"title","body","residentIds","idempotencyKey");
        var account=actor.supervisor();String title=text(body,"title",3,200),content=text(body,"body",3,4000);
        var residents=ids(body,"residentIds",1);UUID key=uuid(body,"idempotencyKey");
        UUID replay=keys.replay(account.id(),"NOTICE_CREATE",key,body);if(replay!=null) return notice(replay);
        residents.forEach(this::requireResident);
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO sager_notice(id,title,body,created_at,created_by) VALUES (?,?,?,?,?)",id,title,content,now(),account.id());
        residents.forEach(resident->jdbc.update("INSERT INTO sager_notice_draft_recipient(notice_id,resident_id) VALUES (?,?)",id,resident));
        audit.record(AuditResource.NOTICE,id,AuditAction.CREATE,0,Set.of("title","body","residentIds"));
        keys.remember(account.id(),"NOTICE_CREATE",key,body,id,now());return notice(id);
    }
    @Transactional
    public Notice publishNotice(UUID id,JsonNode body,boolean revision) {
        if(revision) fields(body,"version","title","body","idempotencyKey");else fields(body,"version","idempotencyKey");
        var account=actor.supervisor();long expected=version(body);UUID key=uuid(body,"idempotencyKey");
        String action=(revision?"NOTICE_REVISE:":"NOTICE_PUBLISH:")+id;
        String title=revision?text(body,"title",3,200):null;
        String content=revision?text(body,"body",3,4000):null;
        UUID replay=keys.replay(account.id(),action,key,body);if(replay!=null) return notice(replay);
        lockNotice(id);Notice notice=notice(id);requireVersion(notice.version(),expected);
        if(!notice.status().equals(revision?"PUBLICADO":"RASCUNHO")) throw conflict("invalid_state","O aviso não está no estado exigido.");
        long next=notice.version()+1;
        if(revision) changeStatus("AVISO",id,"SUPERADO","Nova versão publicada.");
        jdbc.update("UPDATE sager_notice SET title=?,body=?,status='PUBLICADO',version=?,published_at=? WHERE id=?",revision?title:notice.title(),revision?content:notice.body(),next,now(),id);
        publish("AVISO",id,next,revision?title:notice.title(),revision?content:notice.body(),notice.residentIds(),account.id());
        audit.record(AuditResource.NOTICE,id,AuditAction.UPDATE,next,Set.of("contentVersion","status","title","body"));
        keys.remember(account.id(),action,key,body,id,now());return notice(id);
    }
    @Transactional
    public Notice withdrawNotice(UUID id,JsonNode body) {
        fields(body,"version","reason");
        actor.supervisor();long expected=version(body);String reason=text(body,"reason",10,2000);
        lockNotice(id);var item=notice(id);requireVersion(item.version(),expected);
        if(!item.status().equals("PUBLICADO")) throw conflict("invalid_state","Somente aviso publicado pode ser retirado.");
        jdbc.update("UPDATE sager_notice SET status='RETIRADO',withdrawn_at=?,withdrawal_reason=?,version=version+1 WHERE id=?",now(),reason,id);
        changeStatus("AVISO",id,"RETIRADO",reason);
        audit.record(AuditResource.NOTICE,id,AuditAction.END,item.version()+1,Set.of("status","reason"));return notice(id);
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public UUID publish(String kind,UUID source,long contentVersion,String title,String body,List<UUID> recipients,UUID author) {
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO sager_communication(id,kind,source_id,content_version,title,body,published_at,published_by) VALUES (?,?,?,?,?,?,?,?)",id,kind,source,contentVersion,title,body,now(),author);
        for(UUID resident:recipients) jdbc.update("INSERT INTO sager_communication_recipient(communication_id,resident_id) VALUES (?,?)",id,resident);
        audit.record(AuditResource.COMMUNICATION,id,AuditAction.CREATE,contentVersion,Set.of("contentVersion","status"));return id;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void changeStatus(String kind,UUID source,String status,String reason) {
        var rows=jdbc.queryForList("UPDATE sager_communication SET status=?,state_reason=? WHERE kind=? AND source_id=? AND status='PUBLICADO' RETURNING id,content_version",status,reason,kind,source);
        for(var row:rows) audit.record(AuditResource.COMMUNICATION,(UUID)row.get("id"),AuditAction.END,number(row,"content_version"),Set.of("status","reason"));
    }
    @Transactional(readOnly=true)
    public Page<Communication> ownList(String kind,int limit,Long cursor) {
        var account=actor.resident();limit(limit,cursor);
        var rows=jdbc.queryForList("SELECT c.id,c.sequence FROM sager_communication c JOIN sager_communication_recipient r ON r.communication_id=c.id WHERE r.resident_id=? AND c.kind=? AND (?::bigint IS NULL OR c.sequence<?) ORDER BY c.sequence DESC LIMIT ?",account.residentId(),kind,cursor,cursor,limit+1);
        boolean more=rows.size()>limit;var selected=more?rows.subList(0,limit):rows;
        return new Page<>(selected.stream().map(row->communication((UUID)row.get("id"),account.residentId())).toList(),more?number(selected.getLast(),"sequence"):null);
    }
    @Transactional(readOnly=true)
    public Communication own(UUID id) { return communication(id,actor.resident().residentId()); }
    private Communication communication(UUID id,UUID resident) {
        var rows=jdbc.queryForList("""
            SELECT c.*,r.read_at,r.acknowledged_at,t.document_id,t.document_sha256,t.document_size,
                CASE WHEN c.kind='ADVERTENCIA' THEN EXISTS (
                    SELECT 1 FROM sager_warning w JOIN sager_occurrence o ON o.id=w.occurrence_id
                    LEFT JOIN sager_discipline_notification n ON n.occurrence_id=o.id
                    WHERE w.id=c.source_id AND (NOT o.valid OR COALESCE(n.requires_review,false)))
                WHEN c.kind='TERMO' THEN EXISTS (
                    SELECT 1 FROM sager_commitment_basis b JOIN sager_warning w ON w.id=b.warning_id
                    JOIN sager_occurrence o ON o.id=w.occurrence_id
                    LEFT JOIN sager_discipline_notification n ON n.occurrence_id=o.id
                    WHERE b.term_id=c.source_id AND (w.status='ANULADA' OR NOT o.valid OR COALESCE(n.requires_review,false)))
                ELSE false END AS requires_review
            FROM sager_communication c JOIN sager_communication_recipient r ON r.communication_id=c.id
            LEFT JOIN sager_commitment_term t ON c.kind='TERMO' AND t.id=c.source_id
            WHERE c.id=? AND r.resident_id=?
            """,id,resident);
        if(rows.isEmpty()) throw missing();var row=rows.getFirst();
        StoredFile document=row.get("document_id")==null?null:new StoredFile((UUID)row.get("document_id"),(String)row.get("document_sha256"),number(row,"document_size"),StoredFile.STORED);
        return new Communication(id,(String)row.get("kind"),(UUID)row.get("source_id"),number(row,"content_version"),(String)row.get("title"),(String)row.get("body"),time(row.get("published_at")),(String)row.get("status"),(String)row.get("state_reason"),Boolean.TRUE.equals(row.get("requires_review")),time(row.get("read_at")),time(row.get("acknowledged_at")),document);
    }
    @Transactional
    public Communication acknowledge(UUID id,JsonNode body,boolean readOnly) {
        fields(body,"version");
        var account=actor.resident();long expected=version(body);
        if(jdbc.queryForList("SELECT c.id FROM sager_communication c JOIN sager_communication_recipient r ON r.communication_id=c.id WHERE c.id=? AND r.resident_id=? FOR UPDATE OF c,r",id,account.residentId()).isEmpty()) throw missing();
        var item=communication(id,account.residentId());requireVersion(item.contentVersion(),expected);
        if(readOnly && item.readAt()!=null || !readOnly && item.acknowledgedAt()!=null) return item;
        if(!readOnly && !item.status().equals("PUBLICADO")) throw conflict("content_not_current","Esta versão não está vigente para nova ciência.");
        if(readOnly) jdbc.update("UPDATE sager_communication_recipient SET read_at=COALESCE(read_at,?),read_by=COALESCE(read_by,?) WHERE communication_id=? AND resident_id=?",now(),account.id(),id,account.residentId());
        else jdbc.update("UPDATE sager_communication_recipient SET acknowledged_at=COALESCE(acknowledged_at,?),acknowledged_by=COALESCE(acknowledged_by,?) WHERE communication_id=? AND resident_id=?",now(),account.id(),id,account.residentId());
        audit.record(AuditResource.COMMUNICATION,id,readOnly?AuditAction.READ:AuditAction.UPDATE,expected,Set.of(readOnly?"readAt":"acknowledgedAt","residentId"));
        return communication(id,account.residentId());
    }
    private void lockNotice(UUID id) { if(jdbc.queryForList("SELECT id FROM sager_notice WHERE id=? FOR UPDATE",id).isEmpty()) throw missing(); }
    private void requireResident(UUID id) { if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM sager_resident WHERE id=?)",Boolean.class,id))) throw invalid("Destinatário não encontrado."); }
    public static void requireVersion(long actual,long expected) { if(actual!=expected) throw conflict("stale_version","O registro foi alterado. Recarregue antes de confirmar."); }
    private long number(java.util.Map<String,Object> row,String field) { return ((Number)row.get(field)).longValue(); }
    private OffsetDateTime time(Object value) {
        if(value==null) return null;
        if(value instanceof OffsetDateTime t) return t;
        if(value instanceof java.sql.Timestamp t) return t.toInstant().atOffset(ZoneOffset.UTC);
        throw new IllegalStateException("Tipo temporal inesperado.");
    }
    private OffsetDateTime now() { return clock.instant().atOffset(ZoneOffset.UTC); }
}
