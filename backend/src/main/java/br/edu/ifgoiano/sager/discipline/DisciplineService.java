package br.edu.ifgoiano.sager.discipline;

import static br.edu.ifgoiano.sager.discipline.DisciplineModels.*;
import static br.edu.ifgoiano.sager.discipline.DisciplineInput.*;
import static br.edu.ifgoiano.sager.communications.CommunicationService.requireVersion;
import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import br.edu.ifgoiano.sager.audit.*;
import br.edu.ifgoiano.sager.communications.CommunicationService;
import br.edu.ifgoiano.sager.documents.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
@Profile({ "local", "production" })
public class DisciplineService {
    public static final Set<String> CATEGORIES=Set.of("AUSENCIA","ATRASO_RETORNO","LIMPEZA","OUTRA");
    public static final Set<String> SEVERITIES=Set.of("LEVE","MODERADA","GRAVE");
    private final JdbcTemplate jdbc;
    private final DisciplineActor actor;
    private final DisciplineIdempotency keys;
    private final CommunicationService communications;
    private final AuditService audit;
    private final Clock clock;
    private final ObjectMapper json;
    private final PdfTextRenderer pdf;
    private final PrivateFileStore files;
    public DisciplineService(JdbcTemplate jdbc,DisciplineActor actor,DisciplineIdempotency keys,
            CommunicationService communications,AuditService audit,Clock clock,ObjectMapper json,
            PdfTextRenderer pdf,PrivateFileStore files) {
        this.jdbc=jdbc;this.actor=actor;this.keys=keys;this.communications=communications;this.audit=audit;
        this.clock=clock;this.json=json;this.pdf=pdf;this.files=files;
    }
    @Transactional(readOnly=true)
    public Context context() {
        actor.supervisor();return new Context(now(),LocalDate.ofInstant(clock.instant(),ZoneId.of("America/Sao_Paulo")),"America/Sao_Paulo",List.of("AUSENCIA","ATRASO_RETORNO","LIMPEZA","OUTRA"),List.of("LEVE","MODERADA","GRAVE"));
    }
    @Transactional(readOnly=true)
    public Page<Occurrence> occurrences(UUID residentId,int limit,Long cursor) {
        actor.supervisor();return page("sager_occurrence",residentId,limit,cursor,id->occurrence(id,false));
    }
    @Transactional(readOnly=true)
    public Occurrence getOccurrence(UUID id) { actor.supervisor();return occurrence(id,true); }
    private Occurrence occurrence(UUID id,boolean revisions) {
        var rows=jdbc.queryForList("SELECT o.*,r.name AS resident_name FROM sager_occurrence o JOIN sager_resident r ON r.id=o.resident_id WHERE o.id=?",id);
        if(rows.isEmpty()) throw missing();var row=rows.getFirst();
        List<Revision> history=revisions?jdbc.query("SELECT * FROM sager_occurrence_revision WHERE occurrence_id=? ORDER BY version",(rs,n)->new Revision(rs.getLong("version"),rs.getLong("source_version"),rs.getBoolean("valid"),json.readTree(rs.getString("evidence")),rs.getObject("occurred_at",OffsetDateTime.class),rs.getObject("recorded_at",OffsetDateTime.class)),id):List.of();
        return new Occurrence(id,(UUID)row.get("resident_id"),(String)row.get("resident_name"),(String)row.get("source_type"),(UUID)row.get("source_id"),(String)row.get("category"),(boolean)row.get("valid"),number(row,"source_version"),number(row,"version"),time(row.get("occurred_at")),json.readTree(row.get("evidence").toString()),history);
    }
    @Transactional(readOnly=true)
    public Page<Notification> notifications(UUID residentId,String status,int limit,Long cursor) {
        actor.supervisor();limit(limit,cursor);
        if(status!=null && !Set.of("PENDENTE","VISUALIZADA","EM_ANALISE","ARQUIVADA","CONVERTIDA").contains(status)) throw invalid("status inválido.");
        var rows=jdbc.queryForList("SELECT n.id,n.sequence FROM sager_discipline_notification n JOIN sager_occurrence o ON o.id=n.occurrence_id WHERE (?::uuid IS NULL OR o.resident_id=?) AND (?::text IS NULL OR n.status=?) AND (?::bigint IS NULL OR n.sequence<?) ORDER BY n.sequence DESC LIMIT ?",residentId,residentId,status,status,cursor,cursor,limit+1);
        return results(rows,limit,id->notification(id,false));
    }
    @Transactional(readOnly=true)
    public Notification getNotification(UUID id) { actor.supervisor();return notification(id,true); }
    private Notification notification(UUID id,boolean events) {
        var rows=jdbc.queryForList("SELECT n.*,o.resident_id,o.category,o.version AS occurrence_version,o.valid,o.evidence,r.name AS resident_name FROM sager_discipline_notification n JOIN sager_occurrence o ON o.id=n.occurrence_id JOIN sager_resident r ON r.id=o.resident_id WHERE n.id=?",id);
        if(rows.isEmpty()) throw missing();var row=rows.getFirst();
        List<Event> history=events?jdbc.query("SELECT * FROM sager_notification_event WHERE notification_id=? ORDER BY sequence",(rs,n)->new Event(rs.getObject("id",UUID.class),rs.getString("action"),rs.getObject("actor_id",UUID.class),rs.getObject("recorded_at",OffsetDateTime.class),rs.getLong("resulting_version"),rs.getLong("occurrence_version"),rs.getString("reason_code"),rs.getString("reason")),id):List.of();
        return new Notification(id,(UUID)row.get("occurrence_id"),(UUID)row.get("resident_id"),(String)row.get("resident_name"),(String)row.get("category"),(String)row.get("status"),(boolean)row.get("requires_review"),number(row,"version"),number(row,"occurrence_version"),(String)row.get("policy_code"),number(row,"policy_version"),time(row.get("created_at")),(boolean)row.get("valid"),json.readTree(row.get("evidence").toString()),history);
    }
    @Transactional
    public Notification view(UUID id,JsonNode body) {
        fields(body,"version");
        UUID author=actor.supervisor().id();long expected=version(body);var item=lockNotification(id);requireVersion(item.version(),expected);
        if(item.status().equals("PENDENTE")) updateNotification(item,"VISUALIZADA",item.requiresReview(),author,"VISUALIZAR",null,null);
        return notification(id,true);
    }
    @Transactional
    public Notification analyze(UUID id,JsonNode body) {
        fields(body,"version","confirmCurrentEvidence","reason");
        UUID author=actor.supervisor().id();long expected=version(body);var item=lockNotification(id);requireVersion(item.version(),expected);
        boolean confirm=body.has("confirmCurrentEvidence") && body.get("confirmCurrentEvidence").isBoolean() && body.get("confirmCurrentEvidence").asBoolean();
        if(body.has("confirmCurrentEvidence") && !body.get("confirmCurrentEvidence").isBoolean()) throw invalid("confirmCurrentEvidence deve ser booleano.");
        String reason=body.hasNonNull("reason")?text(body,"reason",10,2000):null;
        if(item.status().equals("ARQUIVADA")) throw conflict("invalid_state","Notificação arquivada não é reaberta.");
        if(item.status().equals("CONVERTIDA") && !item.requiresReview()) throw conflict("invalid_state","A decisão terminal permanece preservada.");
        if(confirm && (!item.valid() || reason==null)) throw conflict("invalid_evidence","Confirme apenas evidência válida, com justificativa da revisão.");
        boolean pending=item.requiresReview() && !confirm;
        updateNotification(item,item.status().equals("CONVERTIDA")?"CONVERTIDA":"EM_ANALISE",pending,author,confirm?"REVISAR_ORIGEM":"ANALISAR",null,reason);
        return notification(id,true);
    }
    @Transactional
    public Notification archive(UUID id,JsonNode body) {
        fields(body,"version","reasonCode","reason");
        UUID author=actor.supervisor().id();long expected=version(body);String code=option(body,"reasonCode",Set.of("ORIGEM_RETIFICADA","SEM_EVIDENCIA","NAO_PROCEDE","OUTRO"));String reason=text(body,"reason",10,2000);
        var item=lockNotification(id);requireVersion(item.version(),expected);requireOpen(item);
        updateNotification(item,"ARQUIVADA",false,author,"ARQUIVAR",code,reason);return notification(id,true);
    }
    private Notification lockNotification(UUID id) {
        var rows=jdbc.queryForList("SELECT occurrence_id FROM sager_discipline_notification WHERE id=?",id);if(rows.isEmpty()) throw missing();
        lockOccurrence((UUID)rows.getFirst().get("occurrence_id"));
        jdbc.queryForList("SELECT id FROM sager_discipline_notification WHERE id=? FOR UPDATE",id);
        return notification(id,false);
    }
    private void lockOccurrence(UUID id) { if(jdbc.queryForList("SELECT id FROM sager_occurrence WHERE id=? FOR UPDATE",id).isEmpty()) throw missing(); }
    private void updateNotification(Notification item,String status,boolean review,UUID author,String action,String code,String reason) {
        long next=item.version()+1;
        jdbc.update("UPDATE sager_discipline_notification SET status=?,requires_review=?,reviewed_occurrence_version=?,version=? WHERE id=?",status,review,item.occurrenceVersion(),next,item.id());
        jdbc.update("INSERT INTO sager_notification_event(id,notification_id,action,actor_id,recorded_at,resulting_version,occurrence_version,reason_code,reason) VALUES (?,?,?,?,?,?,?,?,?)",UUID.randomUUID(),item.id(),action,author,now(),next,item.occurrenceVersion(),code,reason);
        audit.record(AuditResource.DISCIPLINE_NOTIFICATION,item.id(),AuditAction.UPDATE,next,Set.of("status","requiresReview","reason"));
    }
    private void requireOpen(Notification item) { if(Set.of("ARQUIVADA","CONVERTIDA").contains(item.status())) throw conflict("invalid_state","A notificação já recebeu decisão terminal."); }
    @Transactional
    public Warning convert(UUID id,JsonNode body) {
        fields(body,"version","idempotencyKey","category","severity","description","justification","warningDate");
        var account=actor.supervisor();var input=warningInput(body);long expected=version(body);UUID key=uuid(body,"idempotencyKey");String action="WARNING_CONVERT:"+id;
        UUID replay=keys.replay(account.id(),action,key,body);if(replay!=null) return warning(replay);
        var item=lockNotification(id);requireVersion(item.version(),expected);requireOpen(item);
        if(item.requiresReview() || !item.valid()) throw conflict("evidence_review_required","Revise a origem vigente antes de converter.");
        if(!item.category().equals(input.category())) throw invalid("A categoria deve corresponder à origem.");
        Warning result=insertWarning(UUID.randomUUID(),item.residentId(),item.occurrenceId(),id,input,account.id());
        updateNotification(item,"CONVERTIDA",false,account.id(),"CONVERTER",null,input.justification());
        keys.remember(account.id(),action,key,body,result.id(),now());return warning(result.id());
    }
    @Transactional
    public Warning createWarning(JsonNode body) {
        fields(body,"residentId","occurrenceId","idempotencyKey","category","severity","description","justification","warningDate");
        var account=actor.supervisor();var input=warningInput(body);UUID resident=uuid(body,"residentId"),key=uuid(body,"idempotencyKey");
        UUID replay=keys.replay(account.id(),"WARNING_CREATE",key,body);if(replay!=null) return warning(replay);
        lockResident(resident);UUID occurrenceId=optionalUuid(body,"occurrenceId");UUID id=UUID.randomUUID();
        if(occurrenceId!=null) {
            lockOccurrence(occurrenceId);var origin=occurrence(occurrenceId,false);
            if(!origin.residentId().equals(resident) || !origin.category().equals(input.category())) throw invalid("Origem e categoria devem corresponder ao residente.");
            if(!origin.valid()) throw conflict("invalid_evidence","A origem está invalidada.");
            if(!jdbc.queryForList("SELECT id FROM sager_discipline_notification WHERE occurrence_id=?",occurrenceId).isEmpty()) throw conflict("use_conversion","Use a análise e conversão da notificação vinculada.");
        } else {
            occurrenceId=UUID.randomUUID();OffsetDateTime at=input.date().atTime(12,0).atZone(ZoneId.of("America/Sao_Paulo")).toOffsetDateTime();
            String evidence="{\"manualDecision\":true}";
            jdbc.update("INSERT INTO sager_occurrence(id,resident_id,source_type,source_id,category,source_version,occurred_at,valid,evidence) VALUES (?,?,'MANUAL',?,?,0,?,true,?::jsonb)",occurrenceId,resident,id,input.category(),at,evidence);
            jdbc.update("INSERT INTO sager_occurrence_revision(occurrence_id,version,source_version,occurred_at,valid,evidence,recorded_at) VALUES (?,0,0,?,true,?::jsonb,?)",occurrenceId,at,evidence,now());
            audit.record(AuditResource.OCCURRENCE,occurrenceId,AuditAction.CREATE,0,Set.of("residentId","sourceType","sourceId","evidence"));
        }
        var result=insertWarning(id,resident,occurrenceId,null,input,account.id());
        keys.remember(account.id(),"WARNING_CREATE",key,body,result.id(),now());return result;
    }
    private Warning insertWarning(UUID id,UUID resident,UUID origin,UUID notification,WarningInput input,UUID author) {
        if(!jdbc.queryForList("SELECT id FROM sager_warning WHERE occurrence_id=? AND status='VIGENTE'",origin).isEmpty()) throw conflict("warning_exists","Já existe advertência vigente para esta origem.");
        jdbc.update("INSERT INTO sager_warning(id,resident_id,occurrence_id,notification_id,category,severity,description,justification,warning_date,issued_at,issued_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",id,resident,origin,notification,input.category(),input.severity(),input.description(),input.justification(),input.date(),now(),author);
        communications.publish("ADVERTENCIA",id,0,"Advertência registrada após análise",input.description()+"\n\nGravidade: "+input.severity()+"\nData: "+input.date()+"\nJustificativa: "+input.justification(),List.of(resident),author);
        audit.record(AuditResource.WARNING,id,AuditAction.CREATE,0,Set.of("residentId","occurrenceId","notificationId","category","severity","description","justification","warningDate"));
        return warning(id);
    }
    private WarningInput warningInput(JsonNode body) {
        String category=option(body,"category",CATEGORIES),severity=option(body,"severity",SEVERITIES);
        String description=text(body,"description",3,1800),reason=text(body,"justification",10,1800);LocalDate date=date(body,"warningDate");
        if(date.isAfter(LocalDate.ofInstant(clock.instant(),ZoneId.of("America/Sao_Paulo")))) throw invalid("A data da advertência não pode ser futura.");
        return new WarningInput(category,severity,description,reason,date);
    }
    private record WarningInput(String category,String severity,String description,String justification,LocalDate date) {}
    @Transactional(readOnly=true)
    public Page<Warning> warnings(UUID resident,int limit,Long cursor) { actor.supervisor();return page("sager_warning",resident,limit,cursor,this::warning); }
    @Transactional(readOnly=true)
    public Warning getWarning(UUID id) { actor.supervisor();return warning(id); }
    private Warning warning(UUID id) {
        var rows=jdbc.queryForList("SELECT w.*,r.name AS resident_name,c.id AS communication_id,COALESCE(NOT o.valid,false) OR COALESCE(n.requires_review,false) AS requires_review FROM sager_warning w JOIN sager_resident r ON r.id=w.resident_id LEFT JOIN sager_occurrence o ON o.id=w.occurrence_id LEFT JOIN sager_discipline_notification n ON n.id=w.notification_id LEFT JOIN sager_communication c ON c.kind='ADVERTENCIA' AND c.source_id=w.id WHERE w.id=?",id);
        if(rows.isEmpty()) throw missing();var row=rows.getFirst();
        return new Warning(id,(UUID)row.get("resident_id"),(String)row.get("resident_name"),(UUID)row.get("occurrence_id"),(UUID)row.get("notification_id"),(String)row.get("category"),(String)row.get("severity"),(String)row.get("description"),(String)row.get("justification"),((java.sql.Date)row.get("warning_date")).toLocalDate(),(String)row.get("status"),(boolean)row.get("requires_review"),time(row.get("issued_at")),(UUID)row.get("issued_by"),(UUID)row.get("communication_id"),number(row,"version"),(String)row.get("annulment_reason"));
    }
    @Transactional
    public Warning annulWarning(UUID id,JsonNode body) {
        fields(body,"version","reason");
        var account=actor.supervisor();long expected=version(body);String reason=text(body,"reason",10,2000);
        if(jdbc.queryForList("SELECT id FROM sager_warning WHERE id=? FOR UPDATE",id).isEmpty()) throw missing();
        var item=warning(id);requireVersion(item.version(),expected);
        if(!item.status().equals("VIGENTE")) throw conflict("invalid_state","A advertência já está anulada.");
        jdbc.update("UPDATE sager_warning SET status='ANULADA',annulled_at=?,annulled_by=?,annulment_reason=?,version=version+1 WHERE id=?",now(),account.id(),reason,id);
        communications.changeStatus("ADVERTENCIA",id,"ANULADO",reason);
        audit.record(AuditResource.WARNING,id,AuditAction.END,item.version()+1,Set.of("status","reason"));return warning(id);
    }
    @Transactional(readOnly=true)
    public List<Recurrence> recurrence(UUID resident) {
        actor.supervisor();requireResident(resident);
        List<Warning> current=eligibleWarnings(resident);
        return List.of("AUSENCIA","ATRASO_RETORNO","LIMPEZA").stream().map(category->{
            var items=current.stream().filter(w->category.equals(w.category())).toList();
            return new Recurrence(category,2,90,items,origins(items).size()>=2);
        }).toList();
    }
    private List<Warning> eligibleWarnings(UUID resident) {
        return jdbc.query("SELECT w.id FROM sager_warning w JOIN sager_occurrence o ON o.id=w.occurrence_id LEFT JOIN sager_discipline_notification n ON n.id=w.notification_id WHERE w.resident_id=? AND w.status='VIGENTE' AND w.category<>'OUTRA' AND w.issued_at>=? AND w.issued_at<=? AND o.valid AND NOT COALESCE(n.requires_review,false) ORDER BY w.issued_at,w.id",(rs,n)->warning(rs.getObject(1,UUID.class)),resident,now().minusDays(90),now());
    }
    private Set<String> origins(List<Warning> warnings) {
        Set<String> values=new HashSet<>();for(var warning:warnings) {
            var origin=occurrence(warning.occurrenceId(),false);values.add(origin.sourceType()+":"+origin.sourceId());
        }return values;
    }
    @Transactional
    public Term issueTerm(UUID resident,JsonNode body) {
        fields(body,"warningIds","decision","confirmed","idempotencyKey");
        var account=actor.supervisor();List<UUID> warningIds=ids(body,"warningIds",2);String decision=text(body,"decision",10,2000);UUID key=uuid(body,"idempotencyKey");
        if(!body.has("confirmed") || !body.get("confirmed").isBoolean() || !body.get("confirmed").asBoolean()) throw invalid("Confirme expressamente a análise humana da reincidência.");
        String action="TERM_ISSUE:"+resident;UUID replay=keys.replay(account.id(),action,key,body);if(replay!=null) return term(replay);
        lockResident(resident);
        String basis=DisciplineIdempotency.hash(warningIds.toString()+":RECURRENCE:1:MODEL:1");
        var prior=jdbc.queryForList("SELECT id FROM sager_commitment_term WHERE resident_id=? AND basis_hash=? AND model_version=1",resident,basis);
        if(!prior.isEmpty()) {UUID id=(UUID)prior.getFirst().get("id");keys.remember(account.id(),action,key,body,id,now());return term(id);}
        // Lock origins first, then their warnings, matching the order used by source reconciliation.
        for(UUID id:warningIds) {var warning=warning(id);if(warning.occurrenceId()!=null) lockOccurrence(warning.occurrenceId());}
        for(UUID id:warningIds) jdbc.queryForList("SELECT id FROM sager_warning WHERE id=? FOR UPDATE",id);
        List<Warning> eligible=eligibleWarnings(resident);List<Warning> selected=new ArrayList<>();
        for(UUID id:warningIds) selected.add(eligible.stream().filter(w->w.id().equals(id)).findFirst().orElseThrow(()->conflict("recurrence_not_eligible","A base contém advertência inválida, anulada, antiga ou com revisão pendente.")));
        String category=selected.getFirst().category();
        if(selected.stream().anyMatch(w->!category.equals(w.category())) || origins(selected).size()<2) throw invalid("Selecione pelo menos duas origens distintas da mesma categoria.");
        String residentName=jdbc.queryForObject("SELECT name FROM sager_resident WHERE id=?",String.class,resident);
        UUID id=UUID.randomUUID(),documentId=UUID.randomUUID();
        List<String> details=selected.stream().map(w->"Advertência "+w.id()+" | "+w.warningDate()+" | "+w.description()+" | Origem "+w.occurrenceId()).toList();
        byte[] bytes=pdf.render(new PdfTextRenderer.Document("Termo de Compromisso","Modelo local v1 | SAGER | "+id,List.of(
            new PdfTextRenderer.Section("Identificação",List.of("Residente: "+residentName,"Cadastro: "+resident,"Supervisor responsável: "+account.name()+" ("+account.id()+")","Emissão: "+now())),
            new PdfTextRenderer.Section("Análise e compromisso",List.of(decision)),
            new PdfTextRenderer.Section("Registros motivadores",details),
            new PdfTextRenderer.Section("Ciência local",List.of("A ciência deste conteúdo é registrada somente pela ação explícita e autenticada do residente no SAGER. A emissão deste documento não comprova ciência. Essa ciência não constitui assinatura eletrônica.","Política local RECURRENCE v1: duas advertências vigentes da mesma categoria, com origens distintas, em 90 dias. Emissão exige confirmação humana; sem penalidade automática.","Este modelo local não representa homologação institucional da AE.")))));
        StoredFile document=files.storeImmutable(documentId,new ByteArrayInputStream(bytes));
        jdbc.update("INSERT INTO sager_commitment_term(id,resident_id,basis_hash,decision,issued_at,issued_by,document_id,document_sha256,document_size) VALUES (?,?,?,?,?,?,?,?,?)",id,resident,basis,decision,now(),account.id(),document.id(),document.sha256(),document.size());
        warningIds.forEach(w->jdbc.update("INSERT INTO sager_commitment_basis(term_id,warning_id) VALUES (?,?)",id,w));
        communications.publish("TERMO",id,0,"Termo de Compromisso",decision+"\n\nDocumento imutável associado. Ciência local não equivale a assinatura eletrônica.",List.of(resident),account.id());
        audit.record(AuditResource.COMMITMENT_TERM,id,AuditAction.CREATE,0,Set.of("residentId","warningIds","decision","document"));
        keys.remember(account.id(),action,key,body,id,now());return term(id);
    }
    @Transactional(readOnly=true)
    public Page<Term> terms(UUID resident,int limit,Long cursor) { actor.supervisor();requireResident(resident);return page("sager_commitment_term",resident,limit,cursor,this::term); }
    @Transactional(readOnly=true)
    public Term getTerm(UUID id) { actor.supervisor();return term(id); }
    private Term term(UUID id) {
        var rows=jdbc.queryForList("SELECT t.*,r.name AS resident_name,c.id AS communication_id FROM sager_commitment_term t JOIN sager_resident r ON r.id=t.resident_id LEFT JOIN sager_communication c ON c.kind='TERMO' AND c.source_id=t.id WHERE t.id=?",id);
        if(rows.isEmpty()) throw missing();var row=rows.getFirst();
        var basis=jdbc.query("SELECT warning_id FROM sager_commitment_basis WHERE term_id=? ORDER BY warning_id",(rs,n)->rs.getObject(1,UUID.class),id);
        return new Term(id,(UUID)row.get("resident_id"),(String)row.get("resident_name"),basis,(String)row.get("decision"),(String)row.get("status"),time(row.get("issued_at")),(UUID)row.get("issued_by"),(UUID)row.get("communication_id"),new StoredFile((UUID)row.get("document_id"),(String)row.get("document_sha256"),number(row,"document_size"),StoredFile.STORED),number(row,"version"),(String)row.get("annulment_reason"));
    }
    @Transactional
    public Term annulTerm(UUID id,JsonNode body) {
        fields(body,"version","reason");
        var account=actor.supervisor();long expected=version(body);String reason=text(body,"reason",10,2000);
        if(jdbc.queryForList("SELECT id FROM sager_commitment_term WHERE id=? FOR UPDATE",id).isEmpty()) throw missing();var item=term(id);requireVersion(item.version(),expected);
        if(!item.status().equals("EMITIDO")) throw conflict("invalid_state","O termo já está anulado.");
        jdbc.update("UPDATE sager_commitment_term SET status='ANULADO',annulled_at=?,annulled_by=?,annulment_reason=?,version=version+1 WHERE id=?",now(),account.id(),reason,id);
        communications.changeStatus("TERMO",id,"ANULADO",reason);audit.record(AuditResource.COMMITMENT_TERM,id,AuditAction.END,item.version()+1,Set.of("status","reason"));return term(id);
    }
    @Transactional(readOnly=true)
    public byte[] document(UUID id,boolean own) {
        var account=own?actor.resident():actor.supervisor();var item=term(id);
        if(own && !account.residentId().equals(item.residentId())) throw missing();
        return files.openVerified(item.document());
    }
    private void requireResident(UUID id) { if(id==null || !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM sager_resident WHERE id=?)",Boolean.class,id))) throw missing(); }
    private void lockResident(UUID id) { if(jdbc.queryForList("SELECT id FROM sager_resident WHERE id=? FOR UPDATE",id).isEmpty()) throw missing(); }
    private <T> Page<T> page(String table,UUID resident,int limit,Long cursor,Function<UUID,T> mapper) {
        limit(limit,cursor);var rows=jdbc.queryForList("SELECT id,sequence FROM "+table+" WHERE (?::uuid IS NULL OR resident_id=?) AND (?::bigint IS NULL OR sequence<?) ORDER BY sequence DESC LIMIT ?",resident,resident,cursor,cursor,limit+1);return results(rows,limit,mapper);
    }
    private <T> Page<T> results(List<Map<String,Object>> rows,int limit,Function<UUID,T> mapper) {
        boolean more=rows.size()>limit;var selected=more?rows.subList(0,limit):rows;
        return new Page<>(selected.stream().map(row->mapper.apply((UUID)row.get("id"))).toList(),more?number(selected.getLast(),"sequence"):null);
    }
    private long number(Map<String,Object> row,String key) { return ((Number)row.get(key)).longValue(); }
    private OffsetDateTime time(Object value) { if(value==null) return null;if(value instanceof OffsetDateTime t) return t;if(value instanceof java.sql.Timestamp t) return t.toInstant().atOffset(ZoneOffset.UTC);throw new IllegalStateException("Tipo temporal inesperado."); }
    private OffsetDateTime now() { return clock.instant().atOffset(ZoneOffset.UTC); }
}
