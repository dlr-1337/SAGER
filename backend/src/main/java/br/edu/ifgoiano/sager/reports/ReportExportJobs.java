package br.edu.ifgoiano.sager.reports;
import static br.edu.ifgoiano.sager.reports.ReportModels.*;
import java.time.*;
import java.util.*;
import br.edu.ifgoiano.sager.audit.*;
import br.edu.ifgoiano.sager.documents.StoredFile;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/** No rendering or filesystem IO occurs in these short transactions. */
@Service @Profile({ "local", "production" })
public class ReportExportJobs {
 private final JdbcTemplate jdbc;private final ReportService reports;private final AuditService audit;private final Clock clock;private final ObjectMapper json;
 public ReportExportJobs(JdbcTemplate jdbc,ReportService reports,AuditService audit,Clock clock,ObjectMapper json){this.jdbc=jdbc;this.reports=reports;this.audit=audit;this.clock=clock;this.json=json;}
 public record Work(UUID jobId,UUID leaseToken,String format,Snapshot snapshot,List<Map<String,Object>> rows){}
 @Transactional
 public Work claim(){
  var rows=jdbc.queryForList("SELECT * FROM sager_report_export WHERE expires_at>? AND (status='PENDING' OR (status='PROCESSING' AND lease_until<=?)) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",now(),now());
  if(rows.isEmpty())return null;var job=rows.getFirst();UUID id=(UUID)job.get("id"),owner=(UUID)job.get("owner_id"),snapshot=(UUID)job.get("snapshot_id"),lease=UUID.randomUUID();
  if(!permitted(owner)){failLocked(job,"permission_revoked");return null;}
  var stored=jdbc.queryForList("SELECT * FROM sager_report_snapshot WHERE id=? AND owner_id=? FOR SHARE",snapshot,owner);if(stored.isEmpty()){failLocked(job,"snapshot_missing");return null;}
  var metadata=reports.decode(stored.getFirst());var data=reports.frozenRows(snapshot);
  String hash=ReportService.contentHash(json.valueToTree(Map.of("catalogVersion",metadata.catalogVersion(),"catalogCode",metadata.catalogCode(),"filters",metadata.filters(),"columns",metadata.columns(),"rows",data,"summary",metadata.summary(),"monthly",metadata.monthly())));
  if(metadata.rowCount()!=data.size()||!metadata.contentHash().equals(hash)){failLocked(job,"snapshot_integrity");return null;}
  jdbc.update("UPDATE sager_report_export SET status='PROCESSING',lease_token=?,lease_until=?,attempts=attempts+1,version=version+1,error_code=NULL WHERE id=?",lease,now().plusMinutes(2),id);
  audit.recordSystem(UUID.randomUUID(),AuditResource.REPORT_EXPORT,id,AuditAction.UPDATE,((Number)job.get("version")).longValue()+1,Set.of("status"));
  return new Work(id,lease,(String)job.get("format"),metadata,data);
 }
 @Transactional
 public boolean finish(Work work,StoredFile file){
  var rows=jdbc.queryForList("SELECT * FROM sager_report_export WHERE id=? FOR UPDATE",work.jobId());if(rows.isEmpty())return false;var r=rows.getFirst();
  if(!"PROCESSING".equals(r.get("status"))||!work.leaseToken().equals(r.get("lease_token")))return false;
  if(!clock.instant().isBefore(ReportService.time(r.get("expires_at")).toInstant())||!permitted((UUID)r.get("owner_id"))){failLocked(r,"permission_or_expiry_changed");return false;}
  jdbc.update("UPDATE sager_report_export SET status='READY',document_id=?,document_sha256=?,document_size=?,lease_token=NULL,lease_until=NULL,version=version+1 WHERE id=?",file.id(),file.sha256(),file.size(),work.jobId());
  audit.recordSystem(UUID.randomUUID(),AuditResource.REPORT_EXPORT,work.jobId(),AuditAction.UPDATE,((Number)r.get("version")).longValue()+1,Set.of("status","document"));return true;
 }
 @Transactional
 public void fail(Work work,String code){
  var rows=jdbc.queryForList("SELECT * FROM sager_report_export WHERE id=? AND status='PROCESSING' AND lease_token=? FOR UPDATE",work.jobId(),work.leaseToken());
  if(!rows.isEmpty())failLocked(rows.getFirst(),code);
 }
 private void failLocked(Map<String,Object> r,String code){
  jdbc.update("UPDATE sager_report_export SET status='FAILED',error_code=?,lease_token=NULL,lease_until=NULL,version=version+1 WHERE id=?",code,r.get("id"));
  audit.recordSystem(UUID.randomUUID(),AuditResource.REPORT_EXPORT,(UUID)r.get("id"),AuditAction.UPDATE,((Number)r.get("version")).longValue()+1,Set.of("status","reason"));
 }
 @Transactional
 public List<UUID> expire(){
  var rows=jdbc.queryForList("SELECT * FROM sager_report_export WHERE expires_at<=? AND status<>'EXPIRED' FOR UPDATE SKIP LOCKED",now());List<UUID> files=new ArrayList<>();
  for(var r:rows){
   if(r.get("document_id")!=null)files.add((UUID)r.get("document_id"));
   jdbc.update("UPDATE sager_report_export SET status='EXPIRED',lease_token=NULL,lease_until=NULL,version=version+1 WHERE id=?",r.get("id"));
   audit.recordSystem(UUID.randomUUID(),AuditResource.REPORT_EXPORT,(UUID)r.get("id"),AuditAction.END,((Number)r.get("version")).longValue()+1,Set.of("status"));
  }
  jdbc.update("INSERT INTO sager_report_expired_snapshot(id,owner_id,expires_at) SELECT id,owner_id,expires_at FROM sager_report_snapshot WHERE expires_at<=? ON CONFLICT DO NOTHING",now());
  jdbc.update("DELETE FROM sager_report_snapshot WHERE expires_at<=?",now());
  return jdbc.query("SELECT document_id FROM sager_report_export WHERE status='EXPIRED' AND document_id IS NOT NULL",(rs,n)->rs.getObject(1,UUID.class));
 }
 @Transactional
 public void forgetExpiredFile(UUID id){jdbc.update("UPDATE sager_report_export SET document_id=NULL,document_sha256=NULL,document_size=NULL WHERE status='EXPIRED' AND document_id=?",id);}
 @Transactional(readOnly=true)
 public Set<UUID> references(){return new HashSet<>(jdbc.query("SELECT document_id FROM sager_report_export WHERE expires_at>? AND document_id IS NOT NULL",(rs,n)->rs.getObject(1,UUID.class),now()));}
 private boolean permitted(UUID owner){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM sager_local_account WHERE id=? AND active AND profile IN ('gestor','supervisor'))",Boolean.class,owner));}
 private OffsetDateTime now(){return clock.instant().atOffset(ZoneOffset.UTC);}
}
