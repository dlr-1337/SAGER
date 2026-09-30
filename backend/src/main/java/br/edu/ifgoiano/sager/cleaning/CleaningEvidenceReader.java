package br.edu.ifgoiano.sager.cleaning;
import java.time.*;
import java.util.UUID;
import br.edu.ifgoiano.sager.discipline.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
@Component @Profile("local")
public class CleaningEvidenceReader implements OccurrenceSourceReader {
 private final JdbcTemplate jdbc;private final ObjectMapper json;
 public CleaningEvidenceReader(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
 public boolean supports(String type){return "CLEANING_ASSESSMENT".equals(type);}
 public Evidence read(String type,UUID id,UUID resident){
  var rows=jdbc.queryForList("SELECT a.* FROM sager_cleaning_assessment a JOIN sager_cleaning_participant p ON p.assessment_id=a.id WHERE a.id=? AND p.resident_id=?",id,resident);if(rows.isEmpty())throw DisciplineInput.missing();var r=rows.getFirst();
  var snapshot=json.createObjectNode();snapshot.put("roomId",r.get("room_id").toString());snapshot.put("assessmentDate",r.get("assessment_date").toString());snapshot.put("policyVersion",1);snapshot.set("criteria",json.readTree(r.get("criteria").toString()));snapshot.put("score",(java.math.BigDecimal)r.get("score"));
  OffsetDateTime at=r.get("evaluated_at") instanceof OffsetDateTime t?t:((java.sql.Timestamp)r.get("evaluated_at")).toInstant().atOffset(ZoneOffset.UTC);
  return new Evidence("LIMPEZA",((Number)r.get("version")).longValue(),at,((java.math.BigDecimal)r.get("score")).compareTo(new java.math.BigDecimal("6.00"))<0,snapshot);
 }
}
