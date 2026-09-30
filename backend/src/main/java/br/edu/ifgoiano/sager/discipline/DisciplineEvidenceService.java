package br.edu.ifgoiano.sager.discipline;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import br.edu.ifgoiano.sager.audit.*;
import br.edu.ifgoiano.sager.operations.OccurrenceEvidenceSink;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import static br.edu.ifgoiano.sager.discipline.OccurrenceSourceReader.Evidence;

@Service
@Profile({ "local", "production" })
public class DisciplineEvidenceService implements OccurrenceEvidenceSink {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final Clock clock;
    private final AuditService audit;
    private final List<OccurrenceSourceReader> readers;
    public DisciplineEvidenceService(JdbcTemplate jdbc,ObjectMapper json,Clock clock,AuditService audit,List<OccurrenceSourceReader> readers) {
        this.jdbc=jdbc;this.json=json;this.clock=clock;this.audit=audit;this.readers=readers;
    }
    @Override
    @Transactional(propagation=Propagation.MANDATORY)
    public void reconcile(String sourceType,UUID sourceId,UUID residentId) {
        if(sourceId==null || residentId==null) throw DisciplineInput.invalid("Origem inválida.");
        Evidence evidence=read(sourceType,sourceId,residentId);
        if(evidence==null) return;
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",sourceType+":"+sourceId+":"+residentId);
        var existing=jdbc.queryForList("SELECT * FROM sager_occurrence WHERE source_type=? AND source_id=? AND resident_id=? FOR UPDATE",sourceType,sourceId,residentId);
        if(existing.isEmpty() && !evidence.qualifies()) return;
        OffsetDateTime now=OffsetDateTime.ofInstant(clock.instant(),ZoneOffset.UTC);
        UUID id;
        long version;
        boolean changed=!existing.isEmpty();
        if(!changed) {
            id=UUID.randomUUID();version=0;
            jdbc.update("INSERT INTO sager_occurrence(id,resident_id,source_type,source_id,category,source_version,occurred_at,valid,evidence) VALUES (?,?,?,?,?,?,?,?,?::jsonb)",id,residentId,sourceType,sourceId,evidence.category(),evidence.sourceVersion(),evidence.occurredAt(),evidence.qualifies(),evidence.snapshot().toString());
        } else {
            var row=existing.getFirst();id=(UUID)row.get("id");
            if(((Number)row.get("source_version")).longValue()==evidence.sourceVersion()
                    && (boolean)row.get("valid")==evidence.qualifies()
                    && json.readTree(row.get("evidence").toString()).equals(evidence.snapshot())) return;
            if(evidence.sourceVersion()<((Number)row.get("source_version")).longValue()) return;
            version=((Number)row.get("version")).longValue()+1;
            jdbc.update("UPDATE sager_occurrence SET source_version=?,occurred_at=?,valid=?,evidence=?::jsonb,version=? WHERE id=?",evidence.sourceVersion(),evidence.occurredAt(),evidence.qualifies(),evidence.snapshot().toString(),version,id);
        }
        jdbc.update("INSERT INTO sager_occurrence_revision(occurrence_id,version,source_version,occurred_at,valid,evidence,recorded_at) VALUES (?,?,?,?,?,?::jsonb,?)",id,version,evidence.sourceVersion(),evidence.occurredAt(),evidence.qualifies(),evidence.snapshot().toString(),now);
        audit.record(AuditResource.OCCURRENCE,id,changed?AuditAction.UPDATE:AuditAction.CREATE,version,Set.of("sourceVersion","evidence","status"));
        String policy=switch(evidence.category()) {case "AUSENCIA" -> "ABSENCE";case "ATRASO_RETORNO" -> "LATE_RETURN";case "LIMPEZA" -> "LOW_CLEANING";default -> null;};
        if(policy==null) return;
        var notifications=jdbc.queryForList("SELECT id,version FROM sager_discipline_notification WHERE occurrence_id=? AND policy_code=? FOR UPDATE",id,policy);
        if(notifications.isEmpty()) {
            if(!evidence.qualifies()) return;
            UUID nid=UUID.randomUUID();
            jdbc.update("INSERT INTO sager_discipline_notification(id,occurrence_id,policy_code,policy_version,reviewed_occurrence_version,created_at) VALUES (?,?,?,1,?,?)",nid,id,policy,version,now);
            audit.record(AuditResource.DISCIPLINE_NOTIFICATION,nid,AuditAction.CREATE,0,Set.of("occurrenceId","status"));
        } else if(changed) {
            for(var notification:notifications) {
                UUID nid=(UUID)notification.get("id");long nv=((Number)notification.get("version")).longValue()+1;
                jdbc.update("UPDATE sager_discipline_notification SET requires_review=true,version=? WHERE id=?",nv,nid);
                audit.record(AuditResource.DISCIPLINE_NOTIFICATION,nid,AuditAction.UPDATE,nv,Set.of("requiresReview"));
            }
        }
    }
    private Evidence read(String type,UUID source,UUID resident) {
        if("NIGHT_CALL".equals(type)) {
            var rows=jdbc.queryForList("SELECT m.mark,m.version,c.version AS call_version,c.status,c.closed_at,c.opened_at,c.reference_date,m.authorized_exit_id FROM sager_night_call_mark m JOIN sager_night_call c ON c.id=m.call_id WHERE m.id=? AND m.resident_id=?",source,resident);
            if(rows.isEmpty()) throw DisciplineInput.missing();var row=rows.getFirst();
            ObjectNode snapshot=json.createObjectNode();snapshot.put("mark",(String)row.get("mark"));snapshot.put("callStatus",(String)row.get("status"));snapshot.put("referenceDate",row.get("reference_date").toString());
            boolean qualifies="FECHADA".equals(row.get("status")) && "AUSENTE".equals(row.get("mark")) && row.get("authorized_exit_id")==null;
            long version=((Number)row.get("call_version")).longValue()+((Number)row.get("version")).longValue();
            return new Evidence("AUSENCIA",version,time(row.get("closed_at")!=null?row.get("closed_at"):row.get("opened_at")),qualifies,snapshot);
        }
        if("SHORT_RETURN".equals(type)) return returnEvidence("sager_short_exit",source,resident);
        if("LONG_RETURN".equals(type)) {
            if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT to_regclass('sager_long_exit') IS NOT NULL",Boolean.class))) return returnEvidence("sager_long_exit",source,resident);
            return null;
        }
        for(var reader:readers) if(reader.supports(type)) return reader.read(type,source,resident);
        throw DisciplineInput.invalid("Tipo de origem não integrado.");
    }
    private Evidence returnEvidence(String table,UUID source,UUID resident) {
        var rows=jdbc.queryForList("SELECT version,status,expected_return_at,actual_return_at,created_at FROM "+table+" WHERE id=? AND resident_id=?",source,resident);
        if(rows.isEmpty()) throw DisciplineInput.missing();var row=rows.getFirst();
        OffsetDateTime expected=time(row.get("expected_return_at"));OffsetDateTime actual=row.get("actual_return_at")==null?null:time(row.get("actual_return_at"));
        ObjectNode snapshot=json.createObjectNode();snapshot.put("status",(String)row.get("status"));snapshot.put("expectedReturnAt",expected.toString());snapshot.put("actualReturnAt",actual==null?null:actual.toString());
        boolean qualifies=actual!=null && actual.isAfter(expected) && "RETORNO_CONFIRMADO_COM_ATRASO".equals(row.get("status"));
        return new Evidence("ATRASO_RETORNO",((Number)row.get("version")).longValue(),actual==null?time(row.get("created_at")):actual,qualifies,snapshot);
    }
    private OffsetDateTime time(Object value) {
        if(value instanceof OffsetDateTime t) return t;
        if(value instanceof java.sql.Timestamp t) return t.toInstant().atOffset(ZoneOffset.UTC);
        throw new IllegalStateException("Tipo temporal inesperado.");
    }
}
