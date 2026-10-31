package br.edu.ifgoiano.sager.reports;
import static br.edu.ifgoiano.sager.reports.ReportModels.*;
import static br.edu.ifgoiano.sager.discipline.DisciplineInput.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import br.edu.ifgoiano.sager.audit.*;
import br.edu.ifgoiano.sager.discipline.DisciplineIdempotency;
import br.edu.ifgoiano.sager.documents.StoredFile;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.*;

@Service @Profile({ "local", "production" })
public class ReportService {
 private final JdbcTemplate jdbc;private final ReportingActor actor;private final ReportCatalog catalog;
 private final DisciplineIdempotency keys;private final Clock clock;private final AuditService audit;private final ObjectMapper json;private final ReportArtifactStore files;
 public ReportService(JdbcTemplate jdbc,ReportingActor actor,ReportCatalog catalog,DisciplineIdempotency keys,Clock clock,AuditService audit,ObjectMapper json,ReportArtifactStore files){this.jdbc=jdbc;this.actor=actor;this.catalog=catalog;this.keys=keys;this.clock=clock;this.audit=audit;this.json=json;this.files=files;}
 @Transactional(readOnly=true)
 public Catalog catalog(){actor.administrative();return catalog.catalog();}
 // Every domain projection is read by a single UNION query; aggregates derive from those rows.
 // READ_COMMITTED allows replay after a concurrent caller releases the idempotency lock.
 @Transactional
 public Snapshot create(JsonNode body){
  fields(body,"catalogCode","filters","idempotencyKey");var account=actor.administrative();String code=text(body,"catalogCode",3,32);var item=catalog.item(code);
  var node=body.get("filters");fields(node,"from","to","accommodationId","unitId","roomId","residentId","status");
  LocalDate from=date(node,"from"),to=date(node,"to");if(from.isAfter(to)||ChronoUnit.DAYS.between(from,to)>365)throw invalid("Informe período entre 1 e 366 dias.");
  Filters filters=new Filters(from,to,optionalUuid(node,"accommodationId"),optionalUuid(node,"roomId"),optionalUuid(node,"residentId"),node.hasNonNull("status")?text(node,"status",1,40):null,optionalUuid(node,"unitId"));
  UUID key=uuid(body,"idempotencyKey");UUID replay=keys.replay(account.id(),"REPORT_SNAPSHOT_CREATE",key,body);if(replay!=null)return snapshot(replay,account.id());
  List<Map<String,Object>> rows=catalog.rows(code,filters);var summary=catalog.summary(rows);var monthly=catalog.monthly(rows,filters);
  String hash=contentHash(json.valueToTree(Map.of("catalogVersion",1,"catalogCode",code,"filters",filters,"columns",item.columns(),"rows",rows,"summary",summary,"monthly",monthly)));
  UUID id=UUID.randomUUID();OffsetDateTime at=now();
  jdbc.update("INSERT INTO sager_report_snapshot(id,owner_id,catalog_code,catalog_version,filters,columns,rows,summary,monthly,row_count,content_hash,as_of,expires_at) VALUES (?,?,?,1,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?,?,?)",id,account.id(),code,json.writeValueAsString(filters),json.writeValueAsString(item.columns()),json.writeValueAsString(rows),json.writeValueAsString(summary),json.writeValueAsString(monthly),rows.size(),hash,at,at.plusHours(24));
  audit.record(AuditResource.REPORT_SNAPSHOT,id,AuditAction.CREATE,0,Set.of("catalogCode","filters","rowCount","expiresAt"));keys.remember(account.id(),"REPORT_SNAPSHOT_CREATE",key,body,id,at);return snapshot(id,account.id());
 }
 /** Reports without records have no file to offer, so they stay out of the list. Rows are never read here. */
 @Transactional(readOnly=true)
 public List<SnapshotListItem> list(){
  UUID owner=actor.administrative().id();OffsetDateTime at=now();Map<UUID,List<Export>> exports=new HashMap<>();
  for(var r:jdbc.queryForList("SELECT * FROM sager_report_export WHERE owner_id=? AND expires_at>?",owner,at)){var item=decodeExport(r);exports.computeIfAbsent(item.snapshotId(),k->new ArrayList<>()).add(item);}
  return jdbc.queryForList("SELECT id,catalog_code,filters,row_count,as_of,expires_at FROM sager_report_snapshot WHERE owner_id=? AND expires_at>? AND row_count>0 ORDER BY as_of DESC,id LIMIT 100",owner,at).stream().map(r->new SnapshotListItem((UUID)r.get("id"),(String)r.get("catalog_code"),json.readValue(r.get("filters").toString(),Filters.class),((Number)r.get("row_count")).intValue(),time(r.get("as_of")),time(r.get("expires_at")),exports.getOrDefault((UUID)r.get("id"),List.of()))).toList();
 }
 @Transactional(readOnly=true)
 public Snapshot get(UUID id){return snapshot(id,actor.administrative().id());}
 Snapshot snapshot(UUID id,UUID owner){
  var rows=jdbc.queryForList("SELECT * FROM sager_report_snapshot WHERE id=? AND owner_id=?",id,owner);if(rows.isEmpty()){if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM sager_report_expired_snapshot WHERE id=? AND owner_id=?)",Boolean.class,id,owner)))throw ReportingApiException.expired();throw missing();}var row=rows.getFirst();requireCurrent(time(row.get("expires_at")));
  return decode(row);
 }
 Snapshot decode(Map<String,Object> r){
  return new Snapshot((UUID)r.get("id"),(String)r.get("catalog_code"),((Number)r.get("catalog_version")).longValue(),json.readValue(r.get("filters").toString(),Filters.class),json.readValue(r.get("columns").toString(),new TypeReference<List<Column>>(){}),((Number)r.get("row_count")).intValue(),json.readValue(r.get("summary").toString(),new TypeReference<Map<String,Object>>(){}),json.readValue(r.get("monthly").toString(),new TypeReference<List<Map<String,Object>>>(){}),(String)r.get("content_hash"),time(r.get("as_of")),time(r.get("expires_at")));
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Rows rows(UUID id,int offset,int size){
  var snapshot=snapshot(id,actor.administrative().id());limit(size);if(offset<0||offset>snapshot.rowCount())throw invalid("offset fora da consulta.");
  var data=frozenRows(id);int end=Math.min(offset+size,data.size());return new Rows(id,offset,size,end<data.size()?end:null,data.size(),data.subList(offset,end));
 }
 List<Map<String,Object>> frozenRows(UUID id){return json.readValue(jdbc.queryForObject("SELECT rows::text FROM sager_report_snapshot WHERE id=?",String.class,id),new TypeReference<List<Map<String,Object>>>(){});}
 @Transactional
 public Export requestExport(UUID id,JsonNode body){
  fields(body,"format");var account=actor.administrative();String format=option(body,"format",Set.of("PDF","XLSX"));
  // One snapshot lock serializes requests for either format without holding any render/IO.
  if(jdbc.queryForList("SELECT id FROM sager_report_snapshot WHERE id=? AND owner_id=? FOR UPDATE",id,account.id()).isEmpty()){
   snapshot(id,account.id());throw missing();
  }
  var snapshot=snapshot(id,account.id());var previous=jdbc.queryForList("SELECT id,status,version FROM sager_report_export WHERE snapshot_id=? AND format=?",id,format);
  if(!previous.isEmpty()){
   var job=previous.getFirst();UUID existing=(UUID)job.get("id");
   // Only a failed job goes back to the queue; claim() repeats the permission and integrity checks.
   if("FAILED".equals(job.get("status"))){jdbc.update("UPDATE sager_report_export SET status='PENDING',error_code=NULL,version=version+1 WHERE id=?",existing);audit.record(AuditResource.REPORT_EXPORT,existing,AuditAction.UPDATE,((Number)job.get("version")).longValue()+1,Set.of("status"));}
   return export(existing,account.id());
  }
  UUID job=UUID.randomUUID();jdbc.update("INSERT INTO sager_report_export(id,snapshot_id,owner_id,format,created_at,expires_at) VALUES (?,?,?,?,?,?)",job,id,account.id(),format,now(),snapshot.expiresAt());
  audit.record(AuditResource.REPORT_EXPORT,job,AuditAction.CREATE,0,Set.of("snapshotId","format","status"));return export(job,account.id());
 }
 @Transactional(readOnly=true)
 public Export getExport(UUID id){return export(id,actor.administrative().id());}
 private Export export(UUID id,UUID owner){
  var rows=jdbc.queryForList("SELECT * FROM sager_report_export WHERE id=? AND owner_id=?",id,owner);if(rows.isEmpty())throw missing();var item=decodeExport(rows.getFirst());return clock.instant().isBefore(item.expiresAt().toInstant())?item:new Export(item.id(),item.snapshotId(),item.format(),"EXPIRED",item.createdAt(),item.expiresAt(),item.attempts(),item.errorCode(),null);
 }
 static Export decodeExport(Map<String,Object> r){StoredFile document=r.get("document_id")==null?null:new StoredFile((UUID)r.get("document_id"),(String)r.get("document_sha256"),((Number)r.get("document_size")).longValue(),StoredFile.STORED);return new Export((UUID)r.get("id"),(UUID)r.get("snapshot_id"),(String)r.get("format"),(String)r.get("status"),time(r.get("created_at")),time(r.get("expires_at")),((Number)r.get("attempts")).intValue(),(String)r.get("error_code"),document);}
 public Download download(UUID id){
  // Authorization and lease-independent metadata query are short; disk IO is outside a transaction.
  var item=getExport(id);requireCurrent(item.expiresAt());if(!item.status().equals("READY")||item.document()==null)throw conflict("export_not_ready","A exportação ainda não está disponível.");var bytes=files.open(item.document());actor.administrative();requireCurrent(item.expiresAt());return new Download(item.format(),bytes);
 }
 public record Download(String format,byte[] bytes){}
 static String contentHash(JsonNode node){return DisciplineIdempotency.hash(canonical(node));}
 private static String canonical(JsonNode node){
  if(node.isObject()){TreeMap<String,String> fields=new TreeMap<>();for(var p:node.properties())fields.put(p.getKey(),canonical(p.getValue()));StringJoiner result=new StringJoiner(",","{","}");fields.forEach((k,v)->result.add(tools.jackson.databind.node.JsonNodeFactory.instance.stringNode(k).toString()+":"+v));return result.toString();}
  if(node.isArray()){StringJoiner result=new StringJoiner(",","[","]");node.forEach(n->result.add(canonical(n)));return result.toString();}
  return node.isNumber()?node.decimalValue().stripTrailingZeros().toPlainString():node.toString();
 }
 private void requireCurrent(OffsetDateTime expires){if(!clock.instant().isBefore(expires.toInstant()))throw ReportingApiException.expired();}
 static OffsetDateTime time(Object value){return value instanceof OffsetDateTime t?t:((java.sql.Timestamp)value).toInstant().atOffset(ZoneOffset.UTC);}
 private OffsetDateTime now(){return clock.instant().atOffset(ZoneOffset.UTC);}
}
