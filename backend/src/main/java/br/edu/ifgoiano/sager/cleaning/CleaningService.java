package br.edu.ifgoiano.sager.cleaning;
import static br.edu.ifgoiano.sager.cleaning.CleaningModels.*;
import static br.edu.ifgoiano.sager.discipline.DisciplineInput.*;
import java.math.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import br.edu.ifgoiano.sager.audit.*;
import br.edu.ifgoiano.sager.discipline.DisciplineIdempotency;
import br.edu.ifgoiano.sager.discipline.DisciplineModels.Page;
import br.edu.ifgoiano.sager.operations.OccurrenceEvidenceSink;
import br.edu.ifgoiano.sager.reports.*;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.*;

@Service @Profile("local")
public class CleaningService {
 public static final ZoneId ZONE=ZoneId.of("America/Sao_Paulo");
 public static final List<String> CRITERIA=List.of("PISO","SUPERFICIES","RESIDUOS","ORGANIZACAO");
 private final JdbcTemplate jdbc; private final ReportingActor actor; private final Clock clock;
 private final ObjectMapper json; private final DisciplineIdempotency keys; private final AuditService audit;
 private final List<OccurrenceEvidenceSink> sinks;
 public CleaningService(JdbcTemplate jdbc,ReportingActor actor,Clock clock,ObjectMapper json,DisciplineIdempotency keys,AuditService audit,List<OccurrenceEvidenceSink> sinks){
  this.jdbc=jdbc;this.actor=actor;this.clock=clock;this.json=json;this.keys=keys;this.audit=audit;this.sinks=sinks;
 }
 @Transactional(readOnly=true)
 public Policy policy(){var a=actor.current();if(!Set.of("gestor","supervisor","residente").contains(a.profile()))throw ReportingApiException.missing();Map<String,BigDecimal> weights=new LinkedHashMap<>();CRITERIA.forEach(c->weights.put(c,new BigDecimal("0.25")));return new Policy(1,weights,new BigDecimal("6.00"),ZONE.getId(),now(),today());}
 // Participants are captured by one INSERT SELECT using a consistent statement snapshot.
 // READ_COMMITTED lets the second idempotency caller observe the first after its advisory lock.
 @Transactional
 public Assessment create(JsonNode body){
  fields(body,"roomId","timeMode","evaluatedAt","registrationReason","criteria","observation","idempotencyKey");
  var account=actor.supervisor();UUID room=uuid(body,"roomId"),key=uuid(body,"idempotencyKey");
  String mode=option(body,"timeMode",Set.of("NOW","RETROACTIVE"));OffsetDateTime evaluated=now();String reason=null;
  if(mode.equals("RETROACTIVE")){
   try{evaluated=OffsetDateTime.parse(text(body,"evaluatedAt",10,64));}catch(DateTimeException e){throw invalid("evaluatedAt deve informar instante e fuso.");}
   if(evaluated.toInstant().isAfter(clock.instant()))throw invalid("A avaliação não pode ser futura.");
   reason=text(body,"registrationReason",10,2000);
  }else if(body.hasNonNull("evaluatedAt")||body.hasNonNull("registrationReason"))throw invalid("NOW usa apenas o instante do servidor.");
  Map<String,BigDecimal> criteria=criteria(body.get("criteria"));BigDecimal score=score(criteria);String observation=optionalText(body,"observation");
  UUID replay=keys.replay(account.id(),"CLEANING_CREATE",key,body);if(replay!=null)return assessment(replay,true);
  var rooms=jdbc.queryForList("SELECT id,code,accommodation_id FROM sager_room WHERE id=? FOR UPDATE",room);if(rooms.isEmpty())throw missing();var row=rooms.getFirst();
  UUID id=UUID.randomUUID();LocalDate date=evaluated.atZoneSameInstant(ZONE).toLocalDate();
  try{jdbc.update("INSERT INTO sager_cleaning_assessment(id,room_id,room_code,accommodation_id,evaluated_at,assessment_date,time_mode,registration_reason,policy_version,criteria,score,observation,recorded_at,recorded_by) VALUES (?,?,?,?,?,?,?,?,1,?::jsonb,?,?,?,?)",id,room,row.get("code"),row.get("accommodation_id"),evaluated,date,mode,reason,json.writeValueAsString(criteria),score,observation,now(),account.id());}
  catch(DuplicateKeyException e){throw conflict("assessment_exists","Já existe avaliação para este quarto e data. Use a correção.");}
  jdbc.update("INSERT INTO sager_cleaning_participant(assessment_id,allocation_id,resident_id,resident_name) SELECT ?,a.id,a.resident_id,r.name FROM sager_room_allocation a JOIN sager_resident r ON r.id=a.resident_id WHERE a.room_id=? AND a.started_at<=? AND (a.ended_at IS NULL OR a.ended_at>?)",id,room,evaluated,evaluated);
  revision(id,0,criteria,score,observation,reason,account.id());reconcile(id);
  audit.record(AuditResource.CLEANING_ASSESSMENT,id,AuditAction.CREATE,0,Set.of("roomId","evaluatedAt","criteria","score","observation","participantIds"));
  keys.remember(account.id(),"CLEANING_CREATE",key,body,id,now());return assessment(id,true);
 }
 @Transactional
 public Assessment correct(UUID id,JsonNode body){
  fields(body,"version","criteria","observation","reason");var account=actor.supervisor();long expected=version(body);
  var criteria=criteria(body.get("criteria"));String reason=text(body,"reason",10,2000),observation=optionalText(body,"observation");BigDecimal score=score(criteria);
  if(jdbc.queryForList("SELECT id FROM sager_cleaning_assessment WHERE id=? FOR UPDATE",id).isEmpty())throw missing();
  var current=assessment(id,false);br.edu.ifgoiano.sager.communications.CommunicationService.requireVersion(current.version(),expected);
  jdbc.update("UPDATE sager_cleaning_assessment SET criteria=?::jsonb,score=?,observation=?,version=version+1,recorded_at=?,recorded_by=? WHERE id=?",json.writeValueAsString(criteria),score,observation,now(),account.id(),id);
  revision(id,expected+1,criteria,score,observation,reason,account.id());reconcile(id);
  audit.record(AuditResource.CLEANING_ASSESSMENT,id,AuditAction.UPDATE,expected+1,Set.of("criteria","score","observation","reason"));return assessment(id,true);
 }
 private void revision(UUID id,long version,Map<String,BigDecimal> criteria,BigDecimal score,String observation,String reason,UUID author){
  jdbc.update("INSERT INTO sager_cleaning_revision(assessment_id,version,criteria,score,observation,reason,recorded_at,recorded_by) VALUES (?,?,?::jsonb,?,?,?,?,?)",id,version,json.writeValueAsString(criteria),score,observation,reason,now(),author);
 }
 private void reconcile(UUID id){for(UUID resident:jdbc.query("SELECT resident_id FROM sager_cleaning_participant WHERE assessment_id=? ORDER BY resident_id",(rs,n)->rs.getObject(1,UUID.class),id))for(var sink:sinks)sink.reconcile("CLEANING_ASSESSMENT",id,resident);}
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Page<Assessment> list(UUID room,UUID resident,LocalDate from,LocalDate to,int size,Long cursor){
  actor.administrative();limit(size,cursor);checkRange(from,to);
  var rows=jdbc.queryForList("SELECT a.id,a.sequence FROM sager_cleaning_assessment a WHERE (?::uuid IS NULL OR room_id=?) AND (?::uuid IS NULL OR EXISTS(SELECT 1 FROM sager_cleaning_participant p WHERE p.assessment_id=a.id AND p.resident_id=?)) AND (?::date IS NULL OR assessment_date>=?) AND (?::date IS NULL OR assessment_date<=?) AND (?::bigint IS NULL OR sequence<?) ORDER BY sequence DESC LIMIT ?",room,room,resident,resident,from,from,to,to,cursor,cursor,size+1);
  boolean more=rows.size()>size;var selected=more?rows.subList(0,size):rows;
  return new Page<>(selected.stream().map(r->assessment((UUID)r.get("id"),false)).toList(),more?((Number)selected.getLast().get("sequence")).longValue():null);
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Assessment get(UUID id){actor.administrative();return assessment(id,true);}
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Page<OwnAssessment> ownList(LocalDate from,LocalDate to,int size,Long cursor){
  UUID resident=actor.resident().residentId();limit(size,cursor);checkRange(from,to);
  var rows=jdbc.queryForList("SELECT a.id,a.sequence FROM sager_cleaning_assessment a JOIN sager_cleaning_participant p ON p.assessment_id=a.id WHERE p.resident_id=? AND (?::date IS NULL OR assessment_date>=?) AND (?::date IS NULL OR assessment_date<=?) AND (?::bigint IS NULL OR sequence<?) ORDER BY sequence DESC LIMIT ?",resident,from,from,to,to,cursor,cursor,size+1);
  boolean more=rows.size()>size;var selected=more?rows.subList(0,size):rows;
  return new Page<>(selected.stream().map(r->ownProjection(assessment((UUID)r.get("id"),false))).toList(),more?((Number)selected.getLast().get("sequence")).longValue():null);
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public OwnAssessment own(UUID id){UUID resident=actor.resident().residentId();if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM sager_cleaning_participant WHERE assessment_id=? AND resident_id=?)",Boolean.class,id,resident)))throw missing();return ownProjection(assessment(id,false));}
 private OwnAssessment ownProjection(Assessment a){return new OwnAssessment(a.id(),a.roomId(),a.roomCode(),a.evaluatedAt(),a.assessmentDate(),a.criteria(),a.score(),a.observation(),a.version(),a.feedback());}
 private Assessment assessment(UUID id,boolean history){
  var rows=jdbc.queryForList("SELECT * FROM sager_cleaning_assessment WHERE id=?",id);if(rows.isEmpty())throw missing();var r=rows.getFirst();
  var participants=jdbc.query("SELECT * FROM sager_cleaning_participant WHERE assessment_id=? ORDER BY resident_id",(rs,n)->new Participant(rs.getObject("allocation_id",UUID.class),rs.getObject("resident_id",UUID.class),rs.getString("resident_name")),id);
  var revisions=history?jdbc.query("SELECT * FROM sager_cleaning_revision WHERE assessment_id=? ORDER BY version",(rs,n)->new Revision(rs.getLong("version"),criteria(json.readTree(rs.getString("criteria"))),rs.getBigDecimal("score"),rs.getString("observation"),rs.getString("reason"),rs.getObject("recorded_at",OffsetDateTime.class),rs.getObject("recorded_by",UUID.class)),id):List.<Revision>of();
  UUID room=(UUID)r.get("room_id");LocalDate date=((java.sql.Date)r.get("assessment_date")).toLocalDate();BigDecimal score=(BigDecimal)r.get("score");long version=((Number)r.get("version")).longValue();
  BigDecimal previous=version==0?null:jdbc.queryForObject("SELECT score FROM sager_cleaning_revision WHERE assessment_id=? AND version=?",BigDecimal.class,id,version-1);
  var period=period("WEEK",date);var ranked=rankRows(period[0],period[1]);var rank=ranked.stream().filter(x->room.equals(x.roomId())).findFirst().orElseThrow();
  Feedback feedback=new Feedback(previous,score,previous==null?null:score.subtract(previous).setScale(2),rank.mean(),rank.position(),"WEEK",period[0],period[1]);
  return new Assessment(id,room,(String)r.get("room_code"),(UUID)r.get("accommodation_id"),time(r.get("evaluated_at")),date,(String)r.get("time_mode"),((Number)r.get("policy_version")).longValue(),criteria(json.readTree(r.get("criteria").toString())),score,(String)r.get("observation"),version,time(r.get("recorded_at")),(UUID)r.get("recorded_by"),participants,revisions,feedback);
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Ranking ranking(String period,LocalDate reference){
  var account=actor.current();if(!Set.of("gestor","supervisor","residente").contains(account.profile()))throw missing();if(account.profile().equals("residente"))actor.resident();
  if(reference==null)reference=today();var range=period(period,reference);var rows=rankRows(range[0],range[1]);
  if(account.profile().equals("residente")){
   var ownRooms=new HashSet<>(jdbc.query("SELECT DISTINCT a.room_id FROM sager_cleaning_assessment a JOIN sager_cleaning_participant p ON p.assessment_id=a.id WHERE p.resident_id=? AND a.assessment_date BETWEEN ? AND ?",(rs,n)->rs.getObject(1,UUID.class),account.residentId(),range[0],range[1]));
   rows=rows.stream().map(r->ownRooms.contains(r.roomId())?new RankRow(r.roomId(),r.roomCode(),r.mean(),r.position(),r.assessmentCount(),true):new RankRow(null,r.roomCode(),null,r.position(),null,false)).toList();
  }
  return new Ranking(period,reference,range[0],range[1],rows);
 }
 private List<RankRow> rankRows(LocalDate from,LocalDate to){
  var rooms=jdbc.queryForList("SELECT r.id,r.code,ROUND(AVG(a.score),2) AS mean,COUNT(a.id) AS count FROM sager_room r LEFT JOIN sager_cleaning_assessment a ON a.room_id=r.id AND a.assessment_date BETWEEN ? AND ? GROUP BY r.id,r.code ORDER BY mean DESC NULLS LAST,r.code,r.id",from,to);
  List<RankRow> result=new ArrayList<>();BigDecimal last=null;int seen=0,position=0;
  for(var r:rooms){BigDecimal mean=(BigDecimal)r.get("mean");Integer current=null;if(mean!=null){seen++;if(last==null||mean.compareTo(last)!=0)position=seen;current=position;last=mean;}result.add(new RankRow((UUID)r.get("id"),(String)r.get("code"),mean,current,((Number)r.get("count")).intValue(),false));}
  return result;
 }
 public static LocalDate[] period(String type,LocalDate reference){
  LocalDate start,end;
  switch(type){case "WEEK"->{start=reference.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));end=start.plusDays(6);}case "MONTH"->{start=reference.withDayOfMonth(1);end=start.plusMonths(1).minusDays(1);}case "SEMESTER"->{start=LocalDate.of(reference.getYear(),reference.getMonthValue()<=6?1:7,1);end=start.plusMonths(6).minusDays(1);}default->throw invalid("period deve ser WEEK, MONTH ou SEMESTER.");}
  return new LocalDate[]{start,end};
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public List<Indicator> indicators(LocalDate from,LocalDate to,UUID resident){
  actor.administrative();if(from==null)from=today().minusMonths(5).withDayOfMonth(1);if(to==null)to=today();checkRange(from,to);if(java.time.temporal.ChronoUnit.DAYS.between(from,to)>365)throw invalid("Período máximo de 366 dias.");
  List<Indicator> result=new ArrayList<>();boolean longPresent=Boolean.TRUE.equals(jdbc.queryForObject("SELECT to_regclass('sager_long_exit') IS NOT NULL",Boolean.class));
  for(LocalDate month=from.withDayOfMonth(1);!month.isAfter(to);month=month.plusMonths(1)){
   LocalDate a=month.isBefore(from)?from:month,b=month.plusMonths(1).minusDays(1).isAfter(to)?to:month.plusMonths(1).minusDays(1);
   long absent=jdbc.queryForObject("SELECT COUNT(*) FROM sager_night_call_mark m JOIN sager_night_call c ON c.id=m.call_id WHERE c.status='FECHADA' AND m.mark='AUSENTE' AND c.reference_date BETWEEN ? AND ? AND (?::uuid IS NULL OR m.resident_id=?)",Long.class,a,b,resident,resident);
   long late=late("sager_short_exit",a,b,resident)+(longPresent?late("sager_long_exit",a,b,resident):0);
   long warnings=jdbc.queryForObject("SELECT COUNT(*) FROM sager_warning WHERE status='VIGENTE' AND warning_date BETWEEN ? AND ? AND (?::uuid IS NULL OR resident_id=?)",Long.class,a,b,resident,resident);
   result.add(new Indicator(month.toString().substring(0,7),absent,late,warnings));
  }return result;
 }
 private long late(String table,LocalDate from,LocalDate to,UUID resident){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE status='RETORNO_CONFIRMADO_COM_ATRASO' AND actual_return_at IS NOT NULL AND (actual_return_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ? AND ? AND (?::uuid IS NULL OR resident_id=?)",Long.class,from,to,resident,resident);}
 private static void checkRange(LocalDate from,LocalDate to){if(from!=null&&to!=null&&from.isAfter(to))throw invalid("from deve anteceder to.");}
 public static Map<String,BigDecimal> criteria(JsonNode node){
  if(node==null||!node.isObject()||node.size()!=4)throw invalid("Informe os quatro critérios.");Map<String,BigDecimal> values=new LinkedHashMap<>();
  for(String c:CRITERIA){var n=node.get(c);if(n==null||!n.isNumber())throw invalid(c+" deve ser número.");BigDecimal v=n.decimalValue();if(v.compareTo(BigDecimal.ZERO)<0||v.compareTo(BigDecimal.TEN)>0||v.stripTrailingZeros().scale()>1)throw invalid(c+" deve estar entre 0 e 10, em passos de 0,1.");values.put(c,v.setScale(1));}
  return values;
 }
 public static BigDecimal score(Map<String,BigDecimal> criteria){return criteria.values().stream().reduce(BigDecimal.ZERO,BigDecimal::add).divide(new BigDecimal("4"),2,RoundingMode.HALF_UP);}
 private String optionalText(JsonNode body,String field){return body.hasNonNull(field)?text(body,field,1,2000):null;}
 private OffsetDateTime time(Object v){return v instanceof OffsetDateTime t?t:((java.sql.Timestamp)v).toInstant().atOffset(ZoneOffset.UTC);}
 private OffsetDateTime now(){return clock.instant().atOffset(ZoneOffset.UTC);}private LocalDate today(){return LocalDate.ofInstant(clock.instant(),ZONE);}
}
