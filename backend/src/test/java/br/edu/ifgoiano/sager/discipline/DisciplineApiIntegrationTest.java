package br.edu.ifgoiano.sager.discipline;

import static org.assertj.core.api.Assertions.*;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="sager.operations.expiry.enabled=false")
@ActiveProfiles("local")
@Import(DisciplineApiIntegrationTest.TimeConfiguration.class)
class DisciplineApiIntegrationTest {
    private static final Instant START=Instant.parse("2026-10-01T01:30:00Z");
    private static final String PASSWORD="Senha sintética 123!";
    private static final PostgreSQLContainer POSTGRES=new PostgreSQLContainer("postgres:17.11");
    private static final Path PRIVATE_ROOT;
    static { POSTGRES.start();try { PRIVATE_ROOT=Files.createTempDirectory("sager-f5-documents-").toAbsolutePath(); } catch(Exception e) { throw new IllegalStateException(e); } }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);r.add("spring.datasource.password",POSTGRES::getPassword);
        r.add("sager.documents.private-root",PRIVATE_ROOT::toString);
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired LocalAccountProvisioningService accounts;
    @Autowired MutableClock clock;
    @Autowired DisciplineEvidenceService evidence;
    @Autowired PlatformTransactionManager transactions;
    @LocalServerPort int port;
    UUID resident,other,accommodation,room;
    @BeforeEach void fixtures() {
        clock.set(START);
        jdbc.update("DELETE FROM spring_session");
        // Do not truncate identity/domain parents: their CASCADE would reach protected health history.
        jdbc.execute("TRUNCATE sager_occurrence,sager_warning,sager_notice,sager_commitment_term,sager_communication,sager_discipline_idempotency,sager_night_call,sager_short_exit RESTART IDENTITY CASCADE");
        jdbc.update("DELETE FROM sager_local_account");
        resident=UUID.randomUUID();other=UUID.randomUUID();accommodation=UUID.randomUUID();room=UUID.randomUUID();
        jdbc.update("INSERT INTO sager_accommodation(id,code,name) VALUES (?,?,'Unidade Sintética')",accommodation,"F5-"+accommodation.toString().substring(0,8));
        jdbc.update("INSERT INTO sager_room(id,code,number,accommodation_id,capacity,situation) VALUES (?,?,'01',?,4,'Disponível')",room,"F5-"+room.toString().substring(0,8),accommodation);
        for(var id:List.of(resident,other)) jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,'Estudante Sintético',?,'2009-01-01')",id,id.toString());
        jdbc.update("INSERT INTO sager_room_allocation(id,resident_id,room_id,started_at) VALUES (?,?,?,?)",UUID.randomUUID(),resident,room,OffsetDateTime.ofInstant(START.minusSeconds(3600),ZoneOffset.UTC));
        for(var profile:List.of("supervisor","gestor","residente")) accounts.create(br.edu.ifgoiano.sager.TestIdentity.enrollment(profile+"@example.invalid"), profile+"@example.invalid","Pessoa Sintética",profile,PASSWORD.toCharArray());
        accounts.linkResident("residente@example.invalid",resident);
        accounts.create(br.edu.ifgoiano.sager.TestIdentity.enrollment("other@example.invalid"), "other@example.invalid","Pessoa Sintética","residente",PASSWORD.toCharArray());accounts.linkResident("other@example.invalid",other);
    }
    @Test void closedCallCreatesOneInternalOriginAndCorrectionPreservesItsHistory() throws Exception {
        try(var sup=login("supervisor");var student=login("residente")) {
            var opened=ok(sup,"POST","/api/v1/chamadas",Map.of("accommodationId",accommodation));String call=opened.path("id").asText();
            ok(sup,"PUT","/api/v1/chamadas/"+call+"/registros/"+resident,Map.of("version",0,"mark","AUSENTE"));
            assertThat(count("sager_occurrence")).isZero();
            ok(sup,"POST","/api/v1/chamadas/"+call+"/fechamento",Map.of("version",1));
            var item=read(sup,"/api/v1/notificacoes").path("items").get(0);String origin=item.path("occurrenceId").asText();
            assertThat(item.path("status").asText()).isEqualTo("PENDENTE");assertThat(count("sager_occurrence")).isEqualTo(1);assertThat(count("sager_discipline_notification")).isEqualTo(1);
            UUID source=jdbc.queryForObject("SELECT source_id FROM sager_occurrence WHERE id=?",UUID.class,UUID.fromString(origin));
            new TransactionTemplate(transactions).executeWithoutResult(tx->evidence.reconcile("NIGHT_CALL",source,resident));
            assertThat(count("sager_occurrence")).isEqualTo(1);assertThat(count("sager_occurrence_revision")).isEqualTo(1);assertThat(count("sager_discipline_notification")).isEqualTo(1);
            read(sup,"/api/v1/notificacoes/"+item.path("id").asText());assertThat(count("sager_notification_event")).isZero();
            assertThat(read(student,"/api/v1/me/advertencias").path("items").size()).isZero();
            assertThat(get(student,"/api/v1/notificacoes").statusCode()).isEqualTo(403);
            ok(sup,"POST","/api/v1/chamadas/"+call+"/correcoes/"+resident,Map.of("version",2,"mark","PRESENTE","justification","Correção após conferência presencial."));
            var revised=read(sup,"/api/v1/ocorrencias/"+origin);
            assertThat(revised.path("valid").asBoolean()).isFalse();assertThat(revised.path("revisions").size()).isEqualTo(2);
            var notification=read(sup,"/api/v1/notificacoes/"+item.path("id").asText());assertThat(notification.path("requiresReview").asBoolean()).isTrue();
            var payload=warningPayload("AUSENCIA");payload.put("version",notification.path("version").asLong());
            assertError(write(sup,"POST","/api/v1/notificacoes/"+item.path("id").asText()+"/converter",payload),409,"evidence_review_required");
            assertThat(count("sager_warning")).isZero();assertThat(count("sager_occurrence")).isEqualTo(1);
            ok(sup,"POST","/api/v1/notificacoes/"+item.path("id").asText()+"/arquivar",Map.of("version",notification.path("version").asLong(),"reasonCode","ORIGEM_RETIFICADA","reason","A ausência inicial foi corrigida para presença."));
            assertThat(read(sup,"/api/v1/notificacoes/"+item.path("id").asText()).path("status").asText()).isEqualTo("ARQUIVADA");
        }
    }
    @Test void actualDelayedReturnCreatesAlertButMereDeadlineAndOnTimeReturnDoNot() throws Exception {
        try(var sup=login("supervisor");var student=login("residente")) {
            var exit=ok(student,"POST","/api/v1/saidas-curtas",Map.of("departureMode","NOW","expectedReturnAt",START.plusSeconds(3600).toString(),"reason","Compromisso sintético"));String id=exit.path("id").asText();
            ok(sup,"POST","/api/v1/saidas-curtas/"+id+"/decisao",Map.of("version",0,"decision","APPROVE"));
            clock.set(START.plusSeconds(1));ok(sup,"POST","/api/v1/saidas-curtas/"+id+"/partida",Map.of("version",1,"timeMode","NOW"));
            clock.set(START.plusSeconds(3601));read(sup,"/api/v1/saidas-curtas/"+id);assertThat(count("sager_occurrence")).isZero();
            ok(sup,"POST","/api/v1/saidas-curtas/"+id+"/retorno",Map.of("version",2,"timeMode","NOW","lateObservation","Trânsito atrasou o retorno confirmado presencialmente."));
            assertThat(count("sager_occurrence")).isEqualTo(1);assertThat(count("sager_warning")).isZero();
            var next=ok(student,"POST","/api/v1/saidas-curtas",Map.of("departureMode","NOW","expectedReturnAt",clock.instant().plusSeconds(3600).toString(),"reason","Outra saída sintética"));id=next.path("id").asText();
            ok(sup,"POST","/api/v1/saidas-curtas/"+id+"/decisao",Map.of("version",0,"decision","APPROVE"));
            clock.set(clock.instant().plusSeconds(1));ok(sup,"POST","/api/v1/saidas-curtas/"+id+"/partida",Map.of("version",1,"timeMode","NOW"));
            clock.set(clock.instant().plusSeconds(30));ok(sup,"POST","/api/v1/saidas-curtas/"+id+"/retorno",Map.of("version",2,"timeMode","NOW"));
            assertThat(count("sager_occurrence")).isEqualTo(1);
        }
    }
    @Test void conversionIsIdempotentConcurrentAndOnlyOwnFormalContentIsPublished() throws Exception {
        try(var sup=login("supervisor");var student=login("residente");var stranger=login("other")) {
            JsonNode notification=closedAbsent(sup);String path="/api/v1/notificacoes/"+notification.path("id").asText()+"/converter";
            var payload=warningPayload("AUSENCIA");payload.put("version",notification.path("version").asLong());String token=csrf(sup),raw=json.writeValueAsString(payload);
            var first=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token));var second=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",path,raw,token));
            var a=first.join();var b=second.join();assertThat(a.statusCode()).isEqualTo(200);assertThat(b.statusCode()).isEqualTo(200);
            assertThat(json.readTree(a.body()).path("id").asText()).isEqualTo(json.readTree(b.body()).path("id").asText());assertThat(count("sager_warning")).isEqualTo(1);
            payload.put("description","Outra descrição muda o payload.");assertError(write(sup,"POST",path,payload),409,"idempotency_mismatch");
            var item=read(student,"/api/v1/me/advertencias").path("items").get(0);String comm=item.path("id").asText();
            assertThat(item.has("evidence")).isFalse();assertThat(item.has("notificationId")).isFalse();assertThat(item.path("acknowledgedAt").isNull()).isTrue();
            assertThat(get(stranger,"/api/v1/me/comunicacoes/"+comm).statusCode()).isEqualTo(404);
            assertThat(get(student,"/api/v1/advertencias/"+json.readTree(a.body()).path("id").asText()).statusCode()).isEqualTo(403);
            ok(sup,"POST","/api/v1/chamadas/"+jdbc.queryForObject("SELECT id FROM sager_night_call",UUID.class)+"/correcoes/"+resident,Map.of("version",2,"mark","PRESENTE","justification","Presença revista após conferência presencial."));
            var warning=read(sup,"/api/v1/advertencias/"+json.readTree(a.body()).path("id").asText());assertThat(warning.path("requiresReview").asBoolean()).isTrue();
            assertThat(read(student,"/api/v1/me/comunicacoes/"+comm).path("requiresReview").asBoolean()).isTrue();
            assertThat(read(sup,"/api/v1/residentes/"+resident+"/reincidencias").get(0).path("warnings").size()).isZero();
        }
    }
    @Test void conversionVersusArchivingProducesOnlyOneTerminalDecision() throws Exception {
        try(var sup=login("supervisor")) {
            var n=closedAbsent(sup);String base="/api/v1/notificacoes/"+n.path("id").asText();String token=csrf(sup);
            var warning=warningPayload("AUSENCIA");warning.put("version",0);
            String convert=json.writeValueAsString(warning),archive=json.writeValueAsString(Map.of("version",0,"reasonCode","NAO_PROCEDE","reason","Contexto não permite confirmação da advertência."));
            var a=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",base+"/converter",convert,token).statusCode());
            var b=CompletableFuture.supplyAsync(()->rawWrite(sup,"POST",base+"/arquivar",archive,token).statusCode());
            assertThat(List.of(a.join(),b.join())).containsExactlyInAnyOrder(200,409);
            assertThat(read(sup,base).path("status").asText()).isIn("CONVERTIDA","ARQUIVADA");assertThat(count("sager_warning")).isBetween(0,1);
        }
    }
    @Test void noticesFreezeRecipientsAndPreserveExplicitScienceAcrossRevisionsAndWithdrawal() throws Exception {
        try(var sup=login("supervisor");var student=login("residente");var stranger=login("other")) {
            UUID key=UUID.randomUUID();var payload=Map.of("title","Aviso sintético","body","Orientação de convivência sintética.","residentIds",List.of(resident),"idempotencyKey",key);
            var draft=ok(sup,"POST","/api/v1/avisos",payload);String notice=draft.path("id").asText();
            assertThat(ok(sup,"POST","/api/v1/avisos",payload).path("id").asText()).isEqualTo(notice);
            assertThat(read(student,"/api/v1/me/avisos").path("items").size()).isZero();
            assertThat(read(sup,"/api/v1/avisos?search=AVISO+sintetico&status=RASCUNHO&residentId="+resident+"&limit=1").path("items").size()).isEqualTo(1);
            assertThat(read(sup,"/api/v1/avisos?search=sintetico&residentId="+other+"&limit=1").path("items").size()).isZero();
            var published=ok(sup,"POST","/api/v1/avisos/"+notice+"/publicar",Map.of("version",0,"idempotencyKey",UUID.randomUUID()));String comm=published.path("communicationId").asText();
            assertThat(read(student,"/api/v1/me/avisos?search=sintetico&acknowledged=false&status=PUBLICADO&limit=1").path("items").size()).isEqualTo(1);
            assertThat(read(stranger,"/api/v1/me/avisos?search=sintetico&acknowledged=false&limit=1").path("items").size()).isZero();
            var own=read(student,"/api/v1/me/comunicacoes/"+comm);assertThat(own.path("readAt").isNull()).isTrue();assertThat(own.path("acknowledgedAt").isNull()).isTrue();
            assertThat(get(stranger,"/api/v1/me/comunicacoes/"+comm).statusCode()).isEqualTo(404);
            ok(student,"POST","/api/v1/me/comunicacoes/"+comm+"/leitura",Map.of("version",1));assertThat(read(student,"/api/v1/me/comunicacoes/"+comm).path("acknowledgedAt").isNull()).isTrue();
            String token=csrf(student),raw="{\"version\":1}";
            var a=CompletableFuture.supplyAsync(()->rawWrite(student,"POST","/api/v1/me/comunicacoes/"+comm+"/ciencia",raw,token));
            var b=CompletableFuture.supplyAsync(()->rawWrite(student,"POST","/api/v1/me/comunicacoes/"+comm+"/ciencia",raw,token));
            assertThat(a.join().statusCode()).isEqualTo(200);assertThat(b.join().statusCode()).isEqualTo(200);
            assertThat(read(student,"/api/v1/me/avisos?acknowledged=true&limit=1").path("items").size()).isEqualTo(1);
            assertThat(read(student,"/api/v1/me/avisos?acknowledged=false&limit=1").path("items").size()).isZero();
            assertThat(get(student,"/api/v1/me/avisos?from=2026-10-16&to=2026-10-15").statusCode()).isEqualTo(400);
            String firstAck=json.readTree(a.join().body()).path("acknowledgedAt").asText();assertThat(json.readTree(b.join().body()).path("acknowledgedAt").asText()).isEqualTo(firstAck);
            var revised=ok(sup,"POST","/api/v1/avisos/"+notice+"/revisar",Map.of("version",1,"title","Aviso revisado","body","Nova orientação publicada para os mesmos destinatários.","idempotencyKey",UUID.randomUUID()));String current=revised.path("communicationId").asText();
            assertThat(current).isNotEqualTo(comm);assertThat(read(student,"/api/v1/me/comunicacoes/"+current).path("acknowledgedAt").isNull()).isTrue();
            assertThat(read(student,"/api/v1/me/comunicacoes/"+comm).path("acknowledgedAt").asText()).isEqualTo(firstAck);
            assertError(write(student,"POST","/api/v1/me/comunicacoes/"+current+"/ciencia",Map.of("version",1)),409,"stale_version");
            ok(sup,"POST","/api/v1/avisos/"+notice+"/retirar",Map.of("version",2,"reason","Retirada após revisão institucional sintética."));
            assertError(write(student,"POST","/api/v1/me/comunicacoes/"+current+"/ciencia",Map.of("version",2)),409,"content_not_current");
            assertThat(count("sager_communication")).isEqualTo(2);
        }
    }
    @Test void recurrenceRequiresHumanConfirmationAndImmutableOwnPdfNeverClaimsSignature() throws Exception {
        try(var sup=login("supervisor");var student=login("residente");var stranger=login("other")) {
            var first=manual(sup,"AUSENCIA");assertThat(read(sup,"/api/v1/residentes/"+resident+"/reincidencias").get(0).path("candidate").asBoolean()).isFalse();
            var second=manual(sup,"AUSENCIA");var candidates=read(sup,"/api/v1/residentes/"+resident+"/reincidencias");assertThat(candidates.get(0).path("candidate").asBoolean()).isTrue();assertThat(count("sager_commitment_term")).isZero();
            var payload=new LinkedHashMap<String,Object>();payload.put("warningIds",List.of(first.path("id").asText(),second.path("id").asText()));payload.put("decision","O supervisor confirmou a relação dos fatos e orientou o compromisso de convivência.");payload.put("confirmed",false);payload.put("idempotencyKey",UUID.randomUUID());
            String path="/api/v1/residentes/"+resident+"/termos";assertError(write(sup,"POST",path,payload),400,"invalid_input");payload.put("confirmed",true);
            var term=ok(sup,"POST",path,payload);String id=term.path("id").asText();assertThat(ok(sup,"POST",path,payload).path("id").asText()).isEqualTo(id);
            payload.put("idempotencyKey",UUID.randomUUID());assertThat(ok(sup,"POST",path,payload).path("id").asText()).isEqualTo(id);assertThat(count("sager_commitment_term")).isEqualTo(1);
            var response=student.send(request("/api/v1/me/termos/"+id+"/documento").GET().build(),HttpResponse.BodyHandlers.ofByteArray());assertThat(response.statusCode()).isEqualTo(200);assertThat(response.headers().firstValue("Content-Type").orElseThrow()).contains("application/pdf");
            try(var pdf=Loader.loadPDF(response.body())) {String text=new PDFTextStripper().getText(pdf).replaceAll("\\s+"," ");assertThat(text).contains("Termo de Compromisso","duas advertências","não constitui assinatura eletrônica");}
            assertThat(get(stranger,"/api/v1/me/termos/"+id+"/documento").statusCode()).isEqualTo(404);
            var own=read(student,"/api/v1/me/termos").path("items").get(0);assertThat(own.has("signed")).isFalse();assertThat(own.path("document").path("sha256").asText()).hasSize(64);
            ok(student,"POST","/api/v1/me/comunicacoes/"+own.path("id").asText()+"/ciencia",Map.of("version",0));
            ok(sup,"POST","/api/v1/advertencias/"+first.path("id").asText()+"/anular",Map.of("version",0,"reason","Advertência anulada após revisão humana motivada."));
            assertThat(read(sup,"/api/v1/residentes/"+resident+"/reincidencias").get(0).path("candidate").asBoolean()).isFalse();
            assertThat(read(student,"/api/v1/me/comunicacoes/"+first.path("communicationId").asText()).path("status").asText()).isEqualTo("ANULADO");
            assertThat(read(student,"/api/v1/me/comunicacoes/"+own.path("id").asText()).path("requiresReview").asBoolean()).isTrue();
            assertThatThrownBy(()->jdbc.update("UPDATE sager_commitment_term SET decision='Mudança indevida' WHERE id=?",UUID.fromString(id))).isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(()->jdbc.update("UPDATE sager_warning SET description='Mudança indevida' WHERE id=?",UUID.fromString(first.path("id").asText()))).isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(()->jdbc.update("UPDATE sager_communication_recipient SET acknowledged_at=acknowledged_at+INTERVAL '1 second' WHERE communication_id=?",UUID.fromString(own.path("id").asText()))).isInstanceOf(DataIntegrityViolationException.class);
        }
    }
    @Test void excludesOtherCategoryAndWarningsOutsideTheRollingWindow() throws Exception {
        try(var sup=login("supervisor")) {
            manual(sup,"OUTRA");manual(sup,"OUTRA");assertThat(read(sup,"/api/v1/residentes/"+resident+"/reincidencias").size()).isEqualTo(3);
            manual(sup,"AUSENCIA");manual(sup,"AUSENCIA");assertThat(read(sup,"/api/v1/residentes/"+resident+"/reincidencias").get(0).path("candidate").asBoolean()).isTrue();
            clock.set(START.plus(Duration.ofDays(91)));assertThat(read(sup,"/api/v1/residentes/"+resident+"/reincidencias").get(0).path("candidate").asBoolean()).isFalse();
        }
    }
    @Test void requiresCsrfSupervisorAndStrictBodiesWithoutGivingGestorOperationalParity() throws Exception {
        try(var sup=login("supervisor");var manager=login("gestor");var student=login("residente")) {
            var payload=warningPayload("AUSENCIA");payload.put("residentId",resident);
            assertThat(rawWrite(sup,"POST","/api/v1/advertencias",json.writeValueAsString(payload),null).statusCode()).isEqualTo(403);
            assertThat(write(manager,"POST","/api/v1/advertencias",payload).statusCode()).isEqualTo(403);assertThat(write(student,"POST","/api/v1/advertencias",payload).statusCode()).isEqualTo(403);
            payload.put("warningDate","2026-10-01");assertError(write(sup,"POST","/api/v1/advertencias",payload),400,"invalid_input");
            payload.put("warningDate","2026-09-30");payload.put("severity","FATAL");assertError(write(sup,"POST","/api/v1/advertencias",payload),400,"invalid_input");
            payload.put("severity","LEVE");payload.put("signed",true);assertError(write(sup,"POST","/api/v1/advertencias",payload),400,"invalid_input");
            assertThat(count("sager_warning")).isZero();
            assertError(get(sup,"/api/v1/notificacoes?beforeSequence=0"),400,"invalid_input");
            assertError(get(student,"/api/v1/me/avisos?limit=101"),400,"invalid_input");
            assertThat(read(sup,"/api/v1/notificacoes/contexto").path("currentDate").asText()).isEqualTo("2026-09-30");
        }
    }
    @Test void auditFailureRollsBackTheOriginCloseAndAllDerivedRecords() throws Exception {
        try(var sup=login("supervisor")) {
            var opened=ok(sup,"POST","/api/v1/chamadas",Map.of("accommodationId",accommodation));String call=opened.path("id").asText();
            ok(sup,"PUT","/api/v1/chamadas/"+call+"/registros/"+resident,Map.of("version",0,"mark","AUSENTE"));
            jdbc.execute("CREATE FUNCTION f5_reject_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='DISCIPLINE_NOTIFICATION' THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN NEW; END; $$");
            jdbc.execute("CREATE TRIGGER f5_reject_audit BEFORE INSERT ON sager_audit_event FOR EACH ROW EXECUTE FUNCTION f5_reject_audit()");
            try { assertThat(write(sup,"POST","/api/v1/chamadas/"+call+"/fechamento",Map.of("version",1)).statusCode()).isEqualTo(500); }
            finally {jdbc.execute("DROP TRIGGER f5_reject_audit ON sager_audit_event");jdbc.execute("DROP FUNCTION f5_reject_audit()");}
            assertThat(read(sup,"/api/v1/chamadas/"+call).path("status").asText()).isEqualTo("ABERTA");assertThat(count("sager_occurrence")).isZero();assertThat(count("sager_discipline_notification")).isZero();
            ok(sup,"POST","/api/v1/chamadas/"+call+"/fechamento",Map.of("version",1));assertThat(count("sager_occurrence")).isEqualTo(1);
        }
    }
    @Test void failedCorrectionAuditKeepsPhysicalMarkAndItsDerivedEvidenceUnchanged() throws Exception {
        try(var sup=login("supervisor")) {
            var notification=closedAbsent(sup);UUID call=jdbc.queryForObject("SELECT id FROM sager_night_call",UUID.class);
            jdbc.execute("CREATE FUNCTION f5_reject_revision_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='OCCURRENCE' AND NEW.action='UPDATE' THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN NEW; END; $$");
            jdbc.execute("CREATE TRIGGER f5_reject_revision_audit BEFORE INSERT ON sager_audit_event FOR EACH ROW EXECUTE FUNCTION f5_reject_revision_audit()");
            try {assertThat(write(sup,"POST","/api/v1/chamadas/"+call+"/correcoes/"+resident,Map.of("version",2,"mark","PRESENTE","justification","Correção presencial sintética com auditoria obrigatória.")).statusCode()).isEqualTo(500);}
            finally {jdbc.execute("DROP TRIGGER f5_reject_revision_audit ON sager_audit_event");jdbc.execute("DROP FUNCTION f5_reject_revision_audit()");}
            assertThat(jdbc.queryForObject("SELECT mark FROM sager_night_call_mark WHERE call_id=?",String.class,call)).isEqualTo("AUSENTE");
            assertThat(read(sup,"/api/v1/chamadas/"+call).path("version").asLong()).isEqualTo(2);
            assertThat(count("sager_occurrence_revision")).isEqualTo(1);assertThat(read(sup,"/api/v1/notificacoes/"+notification.path("id").asText()).path("requiresReview").asBoolean()).isFalse();
        }
    }
    @Test void accountRelinkRevokesTheSessionAndDoesNotTransferFormerOwnersCommunications() throws Exception {
        try(var sup=login("supervisor");var student=login("residente")) {
            var warning=manual(sup,"AUSENCIA");String communication=warning.path("communicationId").asText();
            assertThat(read(student,"/api/v1/me/advertencias").path("items").size()).isEqualTo(1);
            accounts.unlink("other@example.invalid",other);accounts.linkResident("residente@example.invalid",other);
            assertThat(get(student,"/api/v1/me/comunicacoes/"+communication).statusCode()).isEqualTo(401);
            try(var relinked=login("residente")) {
                assertThat(read(relinked,"/api/v1/me/advertencias").path("items").size()).isZero();
                assertThat(get(relinked,"/api/v1/me/comunicacoes/"+communication).statusCode()).isEqualTo(404);
            }
        }
    }
    private JsonNode closedAbsent(HttpClient sup) throws Exception {
        var opened=ok(sup,"POST","/api/v1/chamadas",Map.of("accommodationId",accommodation));String call=opened.path("id").asText();ok(sup,"PUT","/api/v1/chamadas/"+call+"/registros/"+resident,Map.of("version",0,"mark","AUSENTE"));ok(sup,"POST","/api/v1/chamadas/"+call+"/fechamento",Map.of("version",1));return read(sup,"/api/v1/notificacoes").path("items").get(0);
    }
    private JsonNode manual(HttpClient sup,String category) throws Exception {var payload=warningPayload(category);payload.put("residentId",resident);return ok(sup,"POST","/api/v1/advertencias",payload);}
    private Map<String,Object> warningPayload(String category) {
        var values=new LinkedHashMap<String,Object>();values.put("category",category);values.put("severity","LEVE");values.put("description","Registro sintético analisado pelo supervisor.");values.put("justification","Decisão humana motivada com análise do contexto sintético.");values.put("warningDate",LocalDate.ofInstant(clock.instant(),ZoneId.of("America/Sao_Paulo")).toString());values.put("idempotencyKey",UUID.randomUUID());return values;
    }
    private int count(String table) {return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class);}
    private HttpClient login(String name) throws Exception {
        var client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();String token=csrf(client);
        String body="matricula="+URLEncoder.encode(br.edu.ifgoiano.sager.TestIdentity.enrollment(name+"@example.invalid"),StandardCharsets.UTF_8)+"&password="+URLEncoder.encode(PASSWORD,StandardCharsets.UTF_8);
        var response=client.send(request("/api/v1/auth/login").header("Content-Type","application/x-www-form-urlencoded").header("X-CSRF-TOKEN",token).POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());assertThat(response.statusCode()).isEqualTo(204);return client;
    }
    private HttpRequest.Builder request(String path) {return HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path));}
    private HttpResponse<String> get(HttpClient client,String path) throws Exception {return client.send(request(path).GET().build(),HttpResponse.BodyHandlers.ofString());}
    private JsonNode read(HttpClient client,String path) throws Exception {var response=get(client,path);assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(200);return json.readTree(response.body());}
    private String csrf(HttpClient client) throws Exception {return json.readTree(get(client,"/api/v1/auth/csrf").body()).path("token").asText();}
    private HttpResponse<String> write(HttpClient client,String method,String path,Object body) throws Exception {return rawWrite(client,method,path,json.writeValueAsString(body),csrf(client));}
    private HttpResponse<String> rawWrite(HttpClient client,String method,String path,String body,String token) {
        try {var builder=request(path).header("Content-Type","application/json");if(token!=null) builder.header("X-CSRF-TOKEN",token);return client.send(builder.method(method,HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());}catch(Exception error){throw new IllegalStateException(error);}
    }
    private JsonNode ok(HttpClient client,String method,String path,Object body) throws Exception {var response=write(client,method,path,body);assertThat(response.statusCode()).withFailMessage(response.body()).isBetween(200,201);return json.readTree(response.body());}
    private void assertError(HttpResponse<String> response,int status,String code) {assertThat(response.statusCode()).withFailMessage(response.body()).isEqualTo(status);assertThat(json.readTree(response.body()).path("code").asText()).isEqualTo(code);}
    @TestConfiguration static class TimeConfiguration {@Bean @Primary MutableClock clock(){return new MutableClock();}}
    static class MutableClock extends Clock {
        private volatile Instant instant=START;
        void set(Instant value){instant=value;}
        @Override public ZoneId getZone(){return ZoneOffset.UTC;}
        @Override public Clock withZone(ZoneId zone){return this;}
        @Override public Instant instant(){return instant;}
    }
}
