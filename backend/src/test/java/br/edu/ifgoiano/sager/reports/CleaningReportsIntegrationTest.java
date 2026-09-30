package br.edu.ifgoiano.sager.reports;
import static org.assertj.core.api.Assertions.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import br.edu.ifgoiano.sager.documents.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
 properties={"sager.operations.expiry.enabled=false","sager.reports.worker.enabled=false"})
@ActiveProfiles("local") @Import(CleaningReportsIntegrationTest.TimeConfiguration.class)
class CleaningReportsIntegrationTest {
 static final Instant START=Instant.parse("2026-10-01T01:30:00Z");
 static final String PASSWORD="Senha sintética 123!";
 static final PostgreSQLContainer POSTGRES=new PostgreSQLContainer("postgres:17.11");
 static final Path ROOT,REPORTS,PERMANENT;
 static{POSTGRES.start();try{ROOT=Files.createTempDirectory("sager-f6-").toAbsolutePath();REPORTS=ROOT.resolve("reports");PERMANENT=ROOT.resolve("documents");}catch(Exception e){throw new IllegalStateException(e);}}
 @DynamicPropertySource static void properties(DynamicPropertyRegistry r){
  r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);r.add("spring.datasource.password",POSTGRES::getPassword);
  r.add("sager.reports.private-root",REPORTS::toString);r.add("sager.documents.private-root",PERMANENT::toString);
 }
 @Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;@Autowired LocalAccountProvisioningService accounts;
 @Autowired MutableClock clock;@Autowired ReportExportWorker worker;@Autowired ReportExportJobs jobs;
 @Autowired RecordingStore store;@Autowired PrivateFileStore permanent;@Autowired PdfTextRenderer renderer;
 @LocalServerPort int port;
 UUID resident,other,accommodation;List<UUID> rooms;
 @BeforeEach void fixtures(){
  clock.set(START);jdbc.update("DELETE FROM spring_session");
  jdbc.execute("TRUNCATE sager_report_export,sager_report_snapshot,sager_report_expired_snapshot,sager_cleaning_assessment,sager_occurrence,sager_warning,sager_notice,sager_commitment_term,sager_communication,sager_discipline_idempotency,sager_night_call,sager_short_exit RESTART IDENTITY CASCADE");
  jdbc.update("DELETE FROM sager_local_account");
  jdbc.update("DELETE FROM sager_room WHERE code LIKE 'BULK-%' AND number LIKE 'B%'");
  resident=UUID.randomUUID();other=UUID.randomUUID();accommodation=UUID.randomUUID();rooms=new ArrayList<>();
  jdbc.update("INSERT INTO sager_accommodation(id,code,name) VALUES (?,?,'Unidade Sintética')",accommodation,"F6-"+accommodation.toString().substring(0,8));
  for(int i=0;i<4;i++){UUID room=UUID.randomUUID();rooms.add(room);jdbc.update("INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) VALUES (?,?,?, ?,5,'Disponível')",room,"F6-"+room.toString().substring(0,8),Integer.toString(i),accommodation);}
  for(UUID id:List.of(resident,other))jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,'Estudante Sintético',?,'2009-01-01')",id,id.toString());
  allocate(resident,rooms.getFirst(),START.minus(Duration.ofDays(30)));
  for(String profile:List.of("supervisor","gestor","residente"))accounts.create(profile+"@example.invalid","Pessoa Sintética",profile,PASSWORD.toCharArray());
  accounts.linkResident("residente@example.invalid",resident);accounts.create("other@example.invalid","Pessoa Sintética","residente",PASSWORD.toCharArray());accounts.linkResident("other@example.invalid",other);
 }
 @Test void exactDecimalsFirstDeltaDedupAndSameDayConcurrency()throws Exception{
  try(var sup=login("supervisor")){
   var payload=assessment(rooms.getFirst(),"NOW",null,new double[]{.1,.1,.1,.2});String token=csrf(sup),raw=json.writeValueAsString(payload);
   var a=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST","/api/v1/limpeza/avaliacoes",raw,token));
   var b=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST","/api/v1/limpeza/avaliacoes",raw,token));var first=a.join();assertThat(first.statusCode()).withFailMessage(first.body()).isEqualTo(200);assertThat(b.join().statusCode()).isEqualTo(200);
   JsonNode item=json.readTree(first.body());assertThat(item.path("id").asText()).isEqualTo(json.readTree(b.join().body()).path("id").asText());
   assertThat(item.path("score").decimalValue()).isEqualByComparingTo("0.13");assertThat(item.path("feedback").path("previousScore").isNull()).isTrue();assertThat(item.path("feedback").path("delta").isNull()).isTrue();
   payload.put("observation","Conteúdo diferente para a mesma chave.");assertError(write(sup,"POST","/api/v1/limpeza/avaliacoes",payload),409,"idempotency_mismatch");
   assertError(write(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{8,8,8,8})),409,"assessment_exists");
   assertThat(count("sager_cleaning_assessment")).isEqualTo(1);assertThat(count("sager_warning")).isZero();
  }
 }
 @Test void historicalAllocationSnapshotSurvivesTransferAndKeepsUuidOwnership()throws Exception{
  Instant transfer=START.minus(Duration.ofDays(2));jdbc.update("UPDATE sager_room_allocation SET ended_at=?,end_reason='TRANSFER' WHERE resident_id=?",at(transfer),resident);allocate(other,rooms.getFirst(),transfer);
  try(var sup=login("supervisor");var student=login("residente");var stranger=login("other")){
   var past=ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"RETROACTIVE",START.minus(Duration.ofDays(3)),new double[]{5,5,5,5}));
   assertThat(past.path("participants").size()).isEqualTo(1);assertThat(past.path("participants").get(0).path("residentId").asText()).isEqualTo(resident.toString());
   assertThat(read(student,"/api/v1/me/limpeza/avaliacoes/"+past.path("id").asText()).has("participants")).isFalse();
   assertThat(get(stranger,"/api/v1/me/limpeza/avaliacoes/"+past.path("id").asText()).statusCode()).isEqualTo(404);
   var current=ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{8,8,8,8}));
   assertThat(current.path("participants").get(0).path("residentId").asText()).isEqualTo(other.toString());assertThat(read(student,"/api/v1/me/limpeza/avaliacoes").path("items").size()).isEqualTo(1);
   assertThat(jdbc.queryForObject("SELECT resident_id FROM sager_occurrence",UUID.class)).isEqualTo(resident);
  }
 }
 @Test void correctionPreservesIdentityHistoryAndReconcilesEvidenceWithoutAutomaticWarning()throws Exception{
  try(var sup=login("supervisor")){
   var item=ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{5,5,5,5}));String id=item.path("id").asText();
   UUID occurrence=jdbc.queryForObject("SELECT id FROM sager_occurrence",UUID.class);var corrected=ok(sup,"POST","/api/v1/limpeza/avaliacoes/"+id+"/corrigir",Map.of("version",0,"criteria",criteria(new double[]{8,8,8,8}),"reason","Conferência presencial retificou os valores anteriores."));
   assertThat(corrected.path("assessmentDate").asText()).isEqualTo("2026-09-30");assertThat(corrected.path("evaluatedAt").asText()).isEqualTo(item.path("evaluatedAt").asText());assertThat(corrected.path("revisions").size()).isEqualTo(2);
   assertThat(corrected.path("feedback").path("previousScore").decimalValue()).isEqualByComparingTo("5.00");assertThat(corrected.path("feedback").path("delta").decimalValue()).isEqualByComparingTo("3.00");
   assertThat(jdbc.queryForObject("SELECT id FROM sager_occurrence",UUID.class)).isEqualTo(occurrence);assertThat(count("sager_occurrence_revision")).isEqualTo(2);
   assertThat(jdbc.queryForObject("SELECT valid FROM sager_occurrence",Boolean.class)).isFalse();assertThat(jdbc.queryForObject("SELECT requires_review FROM sager_discipline_notification",Boolean.class)).isTrue();assertThat(count("sager_warning")).isZero();
   assertError(write(sup,"POST","/api/v1/limpeza/avaliacoes/"+id+"/corrigir",Map.of("version",0,"criteria",criteria(new double[]{9,9,9,9}),"reason","Outro supervisor usou versão desatualizada.")),409,"stale_version");
   assertThatThrownBy(()->jdbc.update("UPDATE sager_cleaning_revision SET score=0 WHERE assessment_id=?",UUID.fromString(id))).isInstanceOf(DataIntegrityViolationException.class);
   assertThatThrownBy(()->jdbc.update("UPDATE sager_cleaning_assessment SET room_id=? WHERE id=?",rooms.get(1),UUID.fromString(id))).isInstanceOf(DataIntegrityViolationException.class);
  }
 }
 @Test void rankingsTieOneOneThreeAndDoNotRevealOthersScores()throws Exception{
  try(var sup=login("supervisor");var student=login("residente")){
   for(int i=0;i<3;i++)ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.get(i),"NOW",null,new double[]{i<2?8:5,i<2?8:5,i<2?8:5,i<2?8:5}));
   for(String period:List.of("WEEK","MONTH","SEMESTER")){
    var rows=read(sup,"/api/v1/limpeza/ranking?period="+period+"&referenceDate=2026-09-30").path("items");
    assertThat(rank(rows,rooms.get(0)).path("position").asInt()).isEqualTo(1);assertThat(rank(rows,rooms.get(1)).path("position").asInt()).isEqualTo(1);assertThat(rank(rows,rooms.get(2)).path("position").asInt()).isEqualTo(3);assertThat(rank(rows,rooms.get(3)).path("position").isNull()).isTrue();assertThat(rank(rows,rooms.get(3)).path("mean").isNull()).isTrue();
   }
   var own=read(student,"/api/v1/limpeza/ranking").path("items");for(var row:own)if(!row.path("own").asBoolean()){assertThat(row.path("roomId").isNull()).isTrue();assertThat(row.path("mean").isNull()).isTrue();assertThat(row.path("assessmentCount").isNull()).isTrue();}
   assertThat(get(HttpClient.newHttpClient(),"/api/v1/limpeza/ranking").statusCode()).isEqualTo(401);
   assertThat(count("sager_occurrence")).isZero(); // score5 belonged to an empty room.
  }
 }
 @Test void validatesCriteriaDatesBodiesAndDistinctRolePermissions()throws Exception{
  try(var sup=login("supervisor");var manager=login("gestor");var student=login("residente")){
   var payload=assessment(rooms.getFirst(),"NOW",null,new double[]{5.01,5,5,5});assertError(write(sup,"POST","/api/v1/limpeza/avaliacoes",payload),400,"invalid_input");
   payload=assessment(rooms.getFirst(),"RETROACTIVE",START.plusSeconds(1),new double[]{6,6,6,6});assertError(write(sup,"POST","/api/v1/limpeza/avaliacoes",payload),400,"invalid_input");
   payload=assessment(rooms.getFirst(),"NOW",null,new double[]{6,6,6,6});assertThat(write(manager,"POST","/api/v1/limpeza/avaliacoes",payload).statusCode()).isEqualTo(403);assertThat(rawWrite(sup,"POST","/api/v1/limpeza/avaliacoes",json.writeValueAsString(payload),null).statusCode()).isEqualTo(403);
   var exact=ok(sup,"POST","/api/v1/limpeza/avaliacoes",payload);assertThat(count("sager_occurrence")).isZero();assertThat(read(manager,"/api/v1/limpeza/avaliacoes").path("items").size()).isEqualTo(1);assertThat(get(student,"/api/v1/limpeza/avaliacoes").statusCode()).isEqualTo(403);assertThat(read(student,"/api/v1/limpeza/politica").path("currentDate").asText()).isEqualTo("2026-09-30");
   assertThatThrownBy(()->jdbc.update("UPDATE sager_cleaning_assessment SET criteria='{"+"\"PISO\":5.01,\"SUPERFICIES\":6,\"RESIDUOS\":6,\"ORGANIZACAO\":6}' WHERE id=?",UUID.fromString(exact.path("id").asText()))).isInstanceOf(DataIntegrityViolationException.class);
   assertError(get(sup,"/api/v1/limpeza/avaliacoes?limit=101"),400,"invalid_input");
   String token=csrf(sup),path="/api/v1/limpeza/avaliacoes/"+exact.path("id").asText()+"/corrigir",raw=json.writeValueAsString(Map.of("version",0,"criteria",criteria(new double[]{7,7,7,7}),"reason","Correção humana concorrente de exemplo sintético."));
   var a=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token).statusCode());var b=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token).statusCode());assertThat(List.of(a.join(),b.join())).containsExactlyInAnyOrder(200,409);
  }
 }
 @Test void immutableSnapshotCombinedFiltersAndFullExportsKeepLiteralStrings()throws Exception{
  jdbc.update("UPDATE sager_resident SET name='=SUM(1,1)' WHERE id=?",resident);
  try(var sup=login("supervisor")){
   for(int i=0;i<23;i++)ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"RETROACTIVE",START.minus(Duration.ofDays(i)),new double[]{8,8,8,8}));
   var filters=filters();filters.put("roomId",rooms.getFirst());filters.put("residentId",resident);filters.put("accommodationId",accommodation);filters.put("status","DENTRO_LIMITE");
   var snapshot=consult(sup,"LIMPEZA",filters);String id=snapshot.path("id").asText();assertThat(snapshot.path("rowCount").asInt()).isEqualTo(23);assertThat(snapshot.path("contentHash").asText()).hasSize(64);
   var first=read(sup,"/api/v1/relatorios/consultas/"+id+"/linhas?limit=1");assertThat(first.path("items").size()).isEqualTo(1);assertThat(first.path("nextOffset").asInt()).isEqualTo(1);
   var source=jdbc.queryForObject("SELECT id FROM sager_cleaning_assessment WHERE assessment_date='2026-09-30'",UUID.class);
   ok(sup,"POST","/api/v1/limpeza/avaliacoes/"+source+"/corrigir",Map.of("version",0,"criteria",criteria(new double[]{1,1,1,1}),"reason","Domínio alterado depois da consulta congelada."));jdbc.update("UPDATE sager_resident SET name='Novo Nome Sintético' WHERE id=?",resident);
   assertThat(read(sup,"/api/v1/relatorios/consultas/"+id+"/linhas?limit=100").path("items").get(0).path("residentName").asText()).isEqualTo("=SUM(1,1)");
   var xlsx=export(sup,id,"XLSX");var pdf=export(sup,id,"PDF");assertThat(worker.runOnce()).isTrue();assertThat(worker.runOnce()).isTrue();assertThat(store.writtenOutsideTransaction).isTrue();
   var bytes=download(sup,xlsx.path("id").asText());assertThat(bytes.statusCode()).isEqualTo(200);
   try(var workbook=new XSSFWorkbook(new java.io.ByteArrayInputStream(bytes.body()))){var sheet=workbook.getSheet("Resultados");assertThat(sheet.getLastRowNum()).isEqualTo(23);assertThat(sheet.getRow(0).getCell(5).getStringCellValue()).isEqualTo("Residente");assertThat(sheet.getRow(1).getCell(5).getCellType()).isEqualTo(CellType.STRING);assertThat(sheet.getRow(1).getCell(5).getStringCellValue()).isEqualTo("=SUM(1,1)");assertThat(workbook.getSheet("Consulta").getRow(4).getCell(1).getStringCellValue()).isEqualTo("23");}
   var binary=download(sup,pdf.path("id").asText());assertThat(binary.statusCode()).isEqualTo(200);
   try(var document=Loader.loadPDF(binary.body())){String text=new PDFTextStripper().getText(document);assertThat(text).contains("Relatório SAGER","Linhas: 23","=SUM(1,1)",snapshot.path("contentHash").asText());}
   assertThat(bytes.headers().firstValue("Cache-Control").orElseThrow()).contains("no-store");
   assertThatThrownBy(()->jdbc.update("UPDATE sager_report_snapshot SET row_count=0 WHERE id=?",UUID.fromString(id))).isInstanceOf(DataIntegrityViolationException.class);
  }
 }
 @Test void literalPlusMinusAtPrefixesRemainStringCells()throws Exception{
  try(var sup=login("supervisor")){
   for(String prefix:List.of("+","-","@")){
    UUID r=UUID.randomUUID();jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,?,?,'2009-01-01')",r,prefix+"literal",r.toString());allocate(r,rooms.getFirst(),START.minusSeconds(3600));
   }
   ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{8,8,8,8}));
   var snapshot=consult(sup,"LIMPEZA",filters());var job=export(sup,snapshot.path("id").asText(),"XLSX");worker.runOnce();
   try(var workbook=new XSSFWorkbook(new java.io.ByteArrayInputStream(download(sup,job.path("id").asText()).body()))){var sheet=workbook.getSheet("Resultados");Set<String> names=new HashSet<>();for(int i=1;i<=sheet.getLastRowNum();i++){var cell=sheet.getRow(i).getCell(5);assertThat(cell.getCellType()).isEqualTo(CellType.STRING);names.add(cell.getStringCellValue());}assertThat(names).contains("+literal","-literal","@literal");}
  }
 }
 @Test void catalogUsesRealSourcesAndD11CountsAreDistinct()throws Exception{
  try(var sup=login("supervisor");var student=login("residente")){
   var call=ok(sup,"POST","/api/v1/chamadas",Map.of("accommodationId",accommodation));String callId=call.path("id").asText();ok(sup,"PUT","/api/v1/chamadas/"+callId+"/registros/"+resident,Map.of("version",0,"mark","AUSENTE"));ok(sup,"POST","/api/v1/chamadas/"+callId+"/fechamento",Map.of("version",1));
   var exit=ok(student,"POST","/api/v1/saidas-curtas",Map.of("departureMode","NOW","expectedReturnAt",START.plusSeconds(3600).toString(),"reason","Saída sintética"));String exitId=exit.path("id").asText();ok(sup,"POST","/api/v1/saidas-curtas/"+exitId+"/decisao",Map.of("version",0,"decision","APPROVE"));clock.set(START.plusSeconds(1));ok(sup,"POST","/api/v1/saidas-curtas/"+exitId+"/partida",Map.of("version",1,"timeMode","NOW"));clock.set(START.plusSeconds(3601));ok(sup,"POST","/api/v1/saidas-curtas/"+exitId+"/retorno",Map.of("version",2,"timeMode","NOW","lateObservation","Retorno presencial tardio confirmado pelo supervisor."));
   clock.set(START.plusSeconds(3700));ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{5,5,5,5}));
   var a=warning(sup);var b=warning(sup);ok(sup,"POST","/api/v1/residentes/"+resident+"/termos",Map.of("warningIds",List.of(a.path("id").asText(),b.path("id").asText()),"decision","Supervisor confirmou humanamente a relação dos fatos sintéticos.","confirmed",true,"idempotencyKey",UUID.randomUUID()));
   var catalog=read(sup,"/api/v1/relatorios/catalogo");assertThat(catalog.path("items").size()).isEqualTo(8);
   for(var c:catalog.path("items")){var snapshot=consult(sup,c.path("code").asText(),filters());assertThat(snapshot.path("rowCount").asInt()).isGreaterThan(0);String content=read(sup,"/api/v1/relatorios/consultas/"+snapshot.path("id").asText()+"/linhas?limit=100").toString();assertThat(content).doesNotContain("diagnosis","password","token","evidence","justification");}
   var indicators=read(sup,"/api/v1/limpeza/indicadores?from=2026-09-01&to=2026-09-30").get(0);assertThat(indicators.path("unjustifiedAbsences").asInt()).isEqualTo(1);assertThat(indicators.path("confirmedLateReturns").asInt()).isEqualTo(1);assertThat(indicators.path("activeWarnings").asInt()).isEqualTo(2);
   var frozenPresence=consult(sup,"PRESENCA",filters());assertThat(frozenPresence.path("summary").path("unjustifiedAbsences").asInt()).isEqualTo(1);
   ok(sup,"POST","/api/v1/chamadas/"+callId+"/correcoes/"+resident,Map.of("version",2,"mark","PRESENTE","justification","Conferência corrigiu a presença física do estudante sintético."));
   var current=read(sup,"/api/v1/limpeza/indicadores?from=2026-09-01&to=2026-09-30").get(0);assertThat(current.path("unjustifiedAbsences").asInt()).isZero();assertThat(current.path("confirmedLateReturns").asInt()).isEqualTo(1);assertThat(current.path("activeWarnings").asInt()).isEqualTo(2);
   assertThat(consult(sup,"PRESENCA",filters()).path("summary").path("unjustifiedAbsences").asInt()).isZero();assertThat(read(sup,"/api/v1/relatorios/consultas/"+frozenPresence.path("id").asText()).path("summary").path("unjustifiedAbsences").asInt()).isEqualTo(1);
  }
 }
 @Test void rejectsExcessInsteadOfTruncatingAndValidatesTypedFilters()throws Exception{
  try(var sup=login("supervisor")){
   var tooLong=new LinkedHashMap<>(filters());tooLong.put("from","2025-09-29");assertError(write(sup,"POST","/api/v1/relatorios/consultas",Map.of("catalogCode","LIMPEZA","filters",tooLong,"idempotencyKey",UUID.randomUUID())),400,"invalid_input");
   var wrong=new LinkedHashMap<>(filters());wrong.put("residentId","name");assertError(write(sup,"POST","/api/v1/relatorios/consultas",Map.of("catalogCode","LIMPEZA","filters",wrong,"idempotencyKey",UUID.randomUUID())),400,"invalid_input");
   jdbc.update("INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) SELECT gen_random_uuid(),'BULK-'||?||'-'||i::text,'B'||i::text,?,1,'Disponível' FROM generate_series(1,10001)i",accommodation.toString(),accommodation);
   UUID actor=jdbc.queryForObject("SELECT id FROM sager_local_account WHERE profile='supervisor'",UUID.class);
   jdbc.update("INSERT INTO sager_cleaning_assessment(id,room_id,room_code,accommodation_id,evaluated_at,assessment_date,time_mode,policy_version,criteria,score,recorded_at,recorded_by) SELECT gen_random_uuid(),id,code,accommodation_id,?,'2026-09-30','NOW',1,'{\"PISO\":8,\"SUPERFICIES\":8,\"RESIDUOS\":8,\"ORGANIZACAO\":8}',8,?,? FROM sager_room WHERE accommodation_id=? AND number LIKE 'B%'",at(START),at(START),actor,accommodation);
   assertError(write(sup,"POST","/api/v1/relatorios/consultas",Map.of("catalogCode","LIMPEZA","filters",filters(),"idempotencyKey",UUID.randomUUID())),422,"report_limit_exceeded");assertThat(count("sager_report_snapshot")).isZero();
  }
 }
 @Test void persistentLeaseResumesIdleWorkAndDeduplicatesExportRequests()throws Exception{
  try(var sup=login("supervisor")){
   ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{8,8,8,8}));var snapshot=consult(sup,"LIMPEZA",filters());String id=snapshot.path("id").asText(),path="/api/v1/relatorios/consultas/"+id+"/exportacoes",token=csrf(sup),raw="{\"format\":\"XLSX\"}";
   var a=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token));var b=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token));var job=json.readTree(a.join().body());assertThat(a.join().statusCode()).isEqualTo(200);assertThat(b.join().statusCode()).isEqualTo(200);assertThat(job.path("id").asText()).isEqualTo(json.readTree(b.join().body()).path("id").asText());
   var abandoned=jobs.claim();assertThat(abandoned).isNotNull();assertThat(jdbc.queryForObject("SELECT status FROM sager_report_export",String.class)).isEqualTo("PROCESSING");clock.set(START.plusSeconds(121));
   var restarted=new ReportExportWorker(jobs,store,renderer,clock);assertThat(restarted.runOnce()).isTrue();var ready=read(sup,"/api/v1/relatorios/exportacoes/"+job.path("id").asText());assertThat(ready.path("status").asText()).isEqualTo("READY");assertThat(ready.path("attempts").asInt()).isEqualTo(2);assertThat(jobs.finish(abandoned,new StoredFile(UUID.randomUUID(),"0".repeat(64),1,"STORED"))).isFalse();
   assertThat(download(sup,job.path("id").asText()).statusCode()).isEqualTo(200);assertThat(count("sager_report_export")).isEqualTo(1);
  }
 }
 @Test void reportCreationReplaysAfterConcurrentTransactionAndRejectsChangedPayload()throws Exception{
  try(var sup=login("supervisor")){
   ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{8,8,8,8}));
   var body=new LinkedHashMap<String,Object>();body.put("catalogCode","LIMPEZA");body.put("filters",filters());body.put("idempotencyKey",UUID.randomUUID());String token=csrf(sup),raw=json.writeValueAsString(body),path="/api/v1/relatorios/consultas";
   var a=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token));var b=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token));assertThat(a.join().statusCode()).withFailMessage(a.join().body()).isEqualTo(200);assertThat(b.join().statusCode()).withFailMessage(b.join().body()).isEqualTo(200);
   assertThat(json.readTree(a.join().body()).path("id").asText()).isEqualTo(json.readTree(b.join().body()).path("id").asText());assertThat(count("sager_report_snapshot")).isEqualTo(1);
   body.put("catalogCode","OCORRENCIAS");assertError(write(sup,"POST",path,body),409,"idempotency_mismatch");
  }
 }
 @Test void auditFailureRollsBackAssessmentCorrectionAndF5EvidenceTogether()throws Exception{
  try(var sup=login("supervisor")){
   var item=ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{5,5,5,5}));UUID id=UUID.fromString(item.path("id").asText());
   jdbc.execute("CREATE FUNCTION f6_reject_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='CLEANING_ASSESSMENT' AND NEW.action='UPDATE' THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN NEW; END; $$");jdbc.execute("CREATE TRIGGER f6_reject_audit BEFORE INSERT ON sager_audit_event FOR EACH ROW EXECUTE FUNCTION f6_reject_audit()");
   try{assertThat(write(sup,"POST","/api/v1/limpeza/avaliacoes/"+id+"/corrigir",Map.of("version",0,"criteria",criteria(new double[]{8,8,8,8}),"reason","Correção sintética depende de auditoria obrigatória.")).statusCode()).isEqualTo(500);}
   finally{jdbc.execute("DROP TRIGGER f6_reject_audit ON sager_audit_event");jdbc.execute("DROP FUNCTION f6_reject_audit()");}
   assertThat(jdbc.queryForObject("SELECT score FROM sager_cleaning_assessment WHERE id=?",java.math.BigDecimal.class,id)).isEqualByComparingTo("5.00");assertThat(count("sager_cleaning_revision")).isEqualTo(1);assertThat(count("sager_occurrence_revision")).isEqualTo(1);assertThat(jdbc.queryForObject("SELECT valid FROM sager_occurrence",Boolean.class)).isTrue();assertThat(jdbc.queryForObject("SELECT requires_review FROM sager_discipline_notification",Boolean.class)).isFalse();
  }
 }
 @Test void expiresOnlyTransientFilesAndPreservesDomainsAndPermanentDocuments()throws Exception{
  try(var sup=login("supervisor")){
   var durable=permanent.storeImmutable(UUID.randomUUID(),new java.io.ByteArrayInputStream("documento permanente sintético".getBytes(StandardCharsets.UTF_8)));
   ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{5,5,5,5}));var snapshot=consult(sup,"LIMPEZA",filters());var job=export(sup,snapshot.path("id").asText(),"PDF");worker.runOnce();var ready=read(sup,"/api/v1/relatorios/exportacoes/"+job.path("id").asText());UUID file=UUID.fromString(ready.path("document").path("id").asText());assertThat(Files.exists(REPORTS.resolve(file.toString()))).isTrue();int audit=count("sager_audit_event");
   UUID interrupted=UUID.randomUUID();Path abandonedPart=Files.writeString(REPORTS.resolve(interrupted+"-123456.part"),"resíduo sintético"),abandonedLock=Files.writeString(REPORTS.resolve(interrupted+".lock"),""),recentPart=Files.writeString(REPORTS.resolve(UUID.randomUUID()+"-654321.part"),"gravação recente sintética"),unrelated=Files.writeString(REPORTS.resolve("preservar.txt"),"nome não administrado");
   var old=java.nio.file.attribute.FileTime.from(START.minusSeconds(1));Files.setLastModifiedTime(abandonedPart,old);Files.setLastModifiedTime(abandonedLock,old);Files.setLastModifiedTime(unrelated,old);Files.setLastModifiedTime(recentPart,java.nio.file.attribute.FileTime.from(START.plusSeconds(86399)));
   clock.set(START.plus(Duration.ofHours(24)));assertThat(download(sup,job.path("id").asText()).statusCode()).isEqualTo(410);worker.expire();
   assertThat(Files.exists(REPORTS.resolve(file.toString()))).isFalse();assertThat(permanent.openVerified(durable)).isNotEmpty();assertThat(count("sager_cleaning_assessment")).isEqualTo(1);assertThat(count("sager_occurrence")).isEqualTo(1);assertThat(count("sager_occurrence_revision")).isEqualTo(1);assertThat(count("sager_audit_event")).isGreaterThanOrEqualTo(audit);
   assertThat(read(sup,"/api/v1/relatorios/exportacoes/"+job.path("id").asText()).path("status").asText()).isEqualTo("EXPIRED");assertThat(get(sup,"/api/v1/relatorios/consultas/"+snapshot.path("id").asText()).statusCode()).isEqualTo(410);assertThat(count("sager_report_snapshot")).isZero();
   assertThat(write(sup,"POST","/api/v1/relatorios/consultas/"+snapshot.path("id").asText()+"/exportacoes",Map.of("format","XLSX")).statusCode()).isEqualTo(410);assertThat(Files.exists(abandonedPart)).isFalse();assertThat(Files.exists(abandonedLock)).isFalse();assertThat(Files.exists(recentPart)).isTrue();assertThat(Files.exists(unrelated)).isTrue();
  }
 }
 @Test void enforcesPrivateOwnerRevocationAndFileIntegrity()throws Exception{
  try(var sup=login("supervisor");var manager=login("gestor");var student=login("residente")){
   ok(sup,"POST","/api/v1/limpeza/avaliacoes",assessment(rooms.getFirst(),"NOW",null,new double[]{8,8,8,8}));var snapshot=consult(sup,"LIMPEZA",filters());String id=snapshot.path("id").asText();var job=export(sup,id,"PDF");worker.runOnce();String export=job.path("id").asText();
   assertThat(get(manager,"/api/v1/relatorios/consultas/"+id).statusCode()).isEqualTo(404);assertThat(download(manager,export).statusCode()).isEqualTo(404);assertThat(get(student,"/api/v1/relatorios/catalogo").statusCode()).isEqualTo(403);
   var ready=read(sup,"/api/v1/relatorios/exportacoes/"+export);Path file=REPORTS.resolve(ready.path("document").path("id").asText());Files.writeString(file,"conteúdo corrompido sintético");assertThat(download(sup,export).statusCode()).isEqualTo(503);
   var pending=export(sup,id,"XLSX");accounts.disable("supervisor@example.invalid");assertThat(download(sup,export).statusCode()).isEqualTo(401);assertThat(worker.runOnce()).isFalse();assertThat(jdbc.queryForObject("SELECT status FROM sager_report_export WHERE id=?",String.class,UUID.fromString(pending.path("id").asText()))).isEqualTo("FAILED");
  }
 }
 private void allocate(UUID resident,UUID room,Instant started){jdbc.update("INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES (?,?,?,?)",UUID.randomUUID(),resident,room,at(started));}
 private Map<String,Object> assessment(UUID room,String mode,Instant evaluated,double[] score){var payload=new LinkedHashMap<String,Object>();payload.put("roomId",room);payload.put("timeMode",mode);payload.put("criteria",criteria(score));payload.put("idempotencyKey",UUID.randomUUID());if(evaluated!=null){payload.put("evaluatedAt",evaluated.toString());payload.put("registrationReason","Registro histórico autorizado com conferência presencial.");}return payload;}
 private Map<String,Object> criteria(double[] scores){return Map.of("PISO",scores[0],"SUPERFICIES",scores[1],"RESIDUOS",scores[2],"ORGANIZACAO",scores[3]);}
 private Map<String,Object> filters(){var filters=new LinkedHashMap<String,Object>();filters.put("from","2026-09-01");filters.put("to","2026-09-30");return filters;}
 private JsonNode consult(HttpClient client,String code,Map<String,Object> filters)throws Exception{return ok(client,"POST","/api/v1/relatorios/consultas",Map.of("catalogCode",code,"filters",filters,"idempotencyKey",UUID.randomUUID()));}
 private JsonNode export(HttpClient client,String snapshot,String format)throws Exception{return ok(client,"POST","/api/v1/relatorios/consultas/"+snapshot+"/exportacoes",Map.of("format",format));}
 private JsonNode warning(HttpClient client)throws Exception{return ok(client,"POST","/api/v1/advertencias",Map.of("residentId",resident,"category","AUSENCIA","severity","LEVE","description","Fato sintético analisado.","justification","Decisão humana sintética explicitamente motivada.","warningDate","2026-09-30","idempotencyKey",UUID.randomUUID()));}
 private JsonNode rank(JsonNode rows,UUID id){for(var row:rows)if(row.path("roomId").asText().equals(id.toString()))return row;throw new AssertionError("Quarto não encontrado");}
 private int count(String table){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class);}
 private static OffsetDateTime at(Instant time){return time.atOffset(ZoneOffset.UTC);}
 private HttpClient login(String name)throws Exception{var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();String token=csrf(client);var response=client.send(request("/api/v1/auth/login").header("Content-Type","application/x-www-form-urlencoded").header("X-CSRF-TOKEN",token).POST(HttpRequest.BodyPublishers.ofString("email="+URLEncoder.encode(name+"@example.invalid",StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(PASSWORD,StandardCharsets.UTF_8))).build(),HttpResponse.BodyHandlers.ofString());assertThat(response.statusCode()).isEqualTo(204);return client;}
 private HttpRequest.Builder request(String path){return HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path));}
 private HttpResponse<String> get(HttpClient client,String path)throws Exception{return client.send(request(path).GET().build(),HttpResponse.BodyHandlers.ofString());}
 private JsonNode read(HttpClient client,String path)throws Exception{var response=get(client,path);assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);return json.readTree(response.body());}
 private String csrf(HttpClient client)throws Exception{return json.readTree(get(client,"/api/v1/auth/csrf").body()).path("token").asText();}
 private HttpResponse<String> write(HttpClient client,String method,String path,Object body)throws Exception{return rawWrite(client,method,path,json.writeValueAsString(body),csrf(client));}
 private HttpResponse<String> rawWrite(HttpClient client,String method,String path,String body,String token){try{var builder=request(path).header("Content-Type","application/json");if(token!=null)builder.header("X-CSRF-TOKEN",token);return client.send(builder.method(method,HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());}catch(Exception e){throw new IllegalStateException(e);}}
 private JsonNode ok(HttpClient client,String method,String path,Object body)throws Exception{var response=write(client,method,path,body);assertThat(response.statusCode()).withFailMessage(response.body()).isBetween(200,201);return json.readTree(response.body());}
 private void assertError(HttpResponse<String> response,int status,String code)throws Exception{assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(status);assertThat(json.readTree(response.body()).path("code").asText()).isEqualTo(code);}
 private HttpResponse<byte[]> download(HttpClient client,String export)throws Exception{return client.send(request("/api/v1/relatorios/exportacoes/"+export+"/arquivo").GET().build(),HttpResponse.BodyHandlers.ofByteArray());}
 @TestConfiguration static class TimeConfiguration{
  @Bean @Primary MutableClock clock(){return new MutableClock();}
  @Bean @Primary RecordingStore recordingStore(Clock clock){return new RecordingStore(clock);}
 }
 static class RecordingStore extends ReportArtifactStore{
  volatile boolean writtenOutsideTransaction;
  RecordingStore(Clock clock){super(REPORTS.toString(),PERMANENT.toString(),clock);}
  @Override public StoredFile store(UUID id,byte[] bytes){assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();writtenOutsideTransaction=true;return super.store(id,bytes);}
 }
 static class MutableClock extends Clock{private volatile Instant instant=START;void set(Instant value){instant=value;}public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}public Instant instant(){return instant;}}
}
