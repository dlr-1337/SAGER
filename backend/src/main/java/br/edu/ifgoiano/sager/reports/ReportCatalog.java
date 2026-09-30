package br.edu.ifgoiano.sager.reports;
import static br.edu.ifgoiano.sager.reports.ReportModels.*;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Fixed projections only. No clinical table, invitation, credentials or internal analysis column. */
@Component @Profile({ "local", "production" })
public class ReportCatalog {
 private final JdbcTemplate jdbc;
 public ReportCatalog(JdbcTemplate jdbc){this.jdbc=jdbc;}
 private static final List<Column> COLUMNS=List.of(
  new Column("id","Identificador","UUID"),new Column("date","Data","DATE"),
  new Column("type","Tipo","STRING"),new Column("status","Situação","STRING"),
  new Column("residentId","Residente UUID","UUID"),new Column("residentName","Residente","STRING"),
  new Column("roomCode","Quarto","STRING"),new Column("score","Nota","DECIMAL"),
  new Column("category","Categoria","STRING"),new Column("sourceType","Origem","STRING"));
 private static final List<String> EXITS=List.of("AGUARDANDO_ANALISE","APROVADA","REJEITADA","CANCELADA","EXPIRADA","EM_ANDAMENTO","RETORNO_CONFIRMADO","RETORNO_CONFIRMADO_COM_ATRASO");
 public Catalog catalog(){return new Catalog(1,List.of(
  item("PRESENCA","Presença",List.of("PRESENTE","AUSENTE","AUSENCIA_JUSTIFICADA","PENDENTE","CHAMADA_ABERTA")),
  item("SAIDAS","Saídas curtas e longas",EXITS),
  item("LIMPEZA","Avaliações de limpeza",List.of("ABAIXO_LIMITE","DENTRO_LIMITE")),
  item("OCORRENCIAS","Ocorrências",List.of("VALIDA","INVALIDADA")),
  item("NOTIFICACOES","Notificações",List.of("PENDENTE","VISUALIZADA","EM_ANALISE","ARQUIVADA","CONVERTIDA")),
  item("ADVERTENCIAS","Advertências",List.of("VIGENTE","ANULADA")),
  item("TERMOS","Termos de compromisso",List.of("EMITIDO","ANULADO")),
  item("CONSOLIDADO","Consolidado administrativo",List.of())),366,10000,20,100,24);}
 private CatalogItem item(String code,String title,List<String> states){return new CatalogItem(code,title,states,COLUMNS);}
 public CatalogItem item(String code){return catalog().items().stream().filter(i->i.code().equals(code)).findFirst().orElseThrow(()->ReportingApiException.invalid("Catálogo inválido."));}
 public List<Map<String,Object>> rows(String code,Filters filters){
  item(code);if(filters.status()!=null){var states=item(code).statuses();if(code.equals("CONSOLIDADO"))states=catalog().items().stream().flatMap(i->i.statuses().stream()).distinct().toList();if(!states.contains(filters.status()))throw ReportingApiException.invalid("Situação não pertence ao catálogo.");}
  List<String> projections=new ArrayList<>();
  if(code.equals("PRESENCA")||code.equals("CONSOLIDADO"))projections.add("""
   SELECT m.id,c.reference_date AS date,'PRESENCA'::text AS type,CASE WHEN c.status='ABERTA' THEN 'CHAMADA_ABERTA' ELSE COALESCE(m.mark,'PENDENTE') END::text AS status,
    m.resident_id,m.resident_name,m.room_id,r.code AS room_code,c.accommodation_id,
    NULL::numeric AS score,NULL::text AS category,'NIGHT_CALL'::text AS source_type
   FROM sager_night_call_mark m JOIN sager_night_call c ON c.id=m.call_id LEFT JOIN sager_room r ON r.id=m.room_id
   """);
  if(code.equals("SAIDAS")||code.equals("CONSOLIDADO")){
   projections.add(exit("sager_short_exit","SHORT_RETURN"));
   if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT to_regclass('sager_long_exit') IS NOT NULL",Boolean.class)))projections.add(exit("sager_long_exit","LONG_RETURN"));
  }
  if(code.equals("LIMPEZA")||code.equals("CONSOLIDADO"))projections.add("""
   SELECT a.id,a.assessment_date AS date,'LIMPEZA'::text AS type,
    CASE WHEN a.score<6.00 THEN 'ABAIXO_LIMITE' ELSE 'DENTRO_LIMITE' END::text AS status,
    p.resident_id,p.resident_name,a.room_id,a.room_code,a.accommodation_id,a.score,
    'LIMPEZA'::text AS category,'CLEANING_ASSESSMENT'::text AS source_type
   FROM sager_cleaning_assessment a LEFT JOIN sager_cleaning_participant p ON p.assessment_id=a.id
   """);
  if(code.equals("OCORRENCIAS")||code.equals("CONSOLIDADO"))projections.add("""
   SELECT o.id,(o.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,
    'OCORRENCIAS'::text AS type,CASE WHEN o.valid THEN 'VALIDA' ELSE 'INVALIDADA' END::text AS status,
    o.resident_id,r.name AS resident_name,l.room_id,l.room_code,l.accommodation_id,
    NULL::numeric AS score,o.category,o.source_type FROM sager_occurrence o
   JOIN sager_resident r ON r.id=o.resident_id
   """+location("o.resident_id","o.occurred_at"));
  if(code.equals("NOTIFICACOES")||code.equals("CONSOLIDADO"))projections.add("""
   SELECT n.id,(n.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,'NOTIFICACOES'::text AS type,
    n.status,o.resident_id,r.name AS resident_name,l.room_id,l.room_code,l.accommodation_id,
    NULL::numeric AS score,o.category,o.source_type FROM sager_discipline_notification n
   JOIN sager_occurrence o ON o.id=n.occurrence_id JOIN sager_resident r ON r.id=o.resident_id
   """+location("o.resident_id","o.occurred_at"));
  if(code.equals("ADVERTENCIAS")||code.equals("CONSOLIDADO"))projections.add("""
   SELECT w.id,w.warning_date AS date,'ADVERTENCIAS'::text AS type,w.status,w.resident_id,
    r.name AS resident_name,l.room_id,l.room_code,l.accommodation_id,NULL::numeric AS score,
    w.category,o.source_type FROM sager_warning w JOIN sager_resident r ON r.id=w.resident_id
   JOIN sager_occurrence o ON o.id=w.occurrence_id
   """+location("w.resident_id","o.occurred_at"));
  if(code.equals("TERMOS")||code.equals("CONSOLIDADO"))projections.add("""
   SELECT t.id,(t.issued_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,'TERMOS'::text AS type,t.status,
    t.resident_id,r.name AS resident_name,l.room_id,l.room_code,l.accommodation_id,NULL::numeric AS score,
    NULL::text AS category,'RECURRENCE'::text AS source_type FROM sager_commitment_term t
   JOIN sager_resident r ON r.id=t.resident_id
   """+location("t.resident_id","t.issued_at"));
  String sql="SELECT * FROM ("+String.join(" UNION ALL ",projections)+") result WHERE date BETWEEN ? AND ? AND (?::uuid IS NULL OR accommodation_id=?) AND (?::uuid IS NULL OR room_id=?) AND (?::uuid IS NULL OR resident_id=?) AND (?::text IS NULL OR status=?) ORDER BY date,type,id,resident_id NULLS LAST LIMIT 10001";
  var result=jdbc.queryForList(sql,filters.from(),filters.to(),filters.accommodationId(),filters.accommodationId(),filters.roomId(),filters.roomId(),filters.residentId(),filters.residentId(),filters.status(),filters.status());
  if(result.size()>10000)throw new ReportingApiException(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,"report_limit_exceeded","A consulta ultrapassa 10.000 linhas. Reduza o período ou combine filtros.");
  return result.stream().map(r->{Map<String,Object> row=new LinkedHashMap<>();row.put("id",string(r.get("id")));row.put("date",r.get("date").toString());row.put("type",r.get("type"));row.put("status",r.get("status"));row.put("residentId",string(r.get("resident_id")));row.put("residentName",r.get("resident_name"));row.put("roomId",string(r.get("room_id")));row.put("roomCode",r.get("room_code"));row.put("accommodationId",string(r.get("accommodation_id")));row.put("score",r.get("score"));row.put("category",r.get("category"));row.put("sourceType",r.get("source_type"));return row;}).toList();
 }
 private String exit(String table,String source){return "SELECT e.id,(e.requested_departure_at AT TIME ZONE 'America/Sao_Paulo')::date AS date,'SAIDAS'::text AS type,e.status,e.resident_id,e.resident_name,l.room_id,l.room_code,l.accommodation_id,NULL::numeric AS score,NULL::text AS category,'"+source+"'::text AS source_type FROM "+table+" e "+location("e.resident_id","e.requested_departure_at");}
 private String location(String resident,String at){return " LEFT JOIN LATERAL (SELECT a.room_id,r.code AS room_code,r.accommodation_id FROM sager_room_allocation a JOIN sager_room r ON r.id=a.room_id WHERE a.resident_id="+resident+" AND a.started_at<="+at+" AND (a.ended_at IS NULL OR a.ended_at>"+at+") ORDER BY a.started_at DESC,a.id LIMIT 1) l ON true ";}
 private String string(Object value){return value==null?null:value.toString();}
 public Map<String,Object> summary(List<Map<String,Object>> rows){
  Map<String,Long> type=new LinkedHashMap<>(),status=new LinkedHashMap<>();Map<String,BigDecimal> scores=new LinkedHashMap<>();
  for(var row:rows){type.merge(row.get("type").toString(),1L,Long::sum);status.merge(row.get("status").toString(),1L,Long::sum);if(row.get("score")!=null)scores.put(row.get("id").toString(),new BigDecimal(row.get("score").toString()));}
  Map<String,Object> result=new LinkedHashMap<>();result.put("totalRows",rows.size());result.put("countsByType",type);result.put("countsByStatus",status);result.put("cleaningMean",mean(scores.values()));
  result.put("unjustifiedAbsences",rows.stream().filter(r->"PRESENCA".equals(r.get("type"))&&"AUSENTE".equals(r.get("status"))).count());
  result.put("confirmedLateReturns",rows.stream().filter(r->"SAIDAS".equals(r.get("type"))&&"RETORNO_CONFIRMADO_COM_ATRASO".equals(r.get("status"))).count());
  result.put("activeWarnings",rows.stream().filter(r->"ADVERTENCIAS".equals(r.get("type"))&&"VIGENTE".equals(r.get("status"))).count());return result;
 }
 public List<Map<String,Object>> monthly(List<Map<String,Object>> rows,Filters filters){
  List<Map<String,Object>> result=new ArrayList<>();
  for(LocalDate month=filters.from().withDayOfMonth(1);!month.isAfter(filters.to());month=month.plusMonths(1)){
   String key=month.toString().substring(0,7);var selected=rows.stream().filter(r->r.get("date").toString().startsWith(key)).toList();
   Map<String,Object> row=new LinkedHashMap<>();row.put("month",key);row.putAll(summary(selected));result.add(row);
  }return result;
 }
 private BigDecimal mean(Collection<BigDecimal> scores){return scores.isEmpty()?null:scores.stream().reduce(BigDecimal.ZERO,BigDecimal::add).divide(BigDecimal.valueOf(scores.size()),2,RoundingMode.HALF_UP);}
}
