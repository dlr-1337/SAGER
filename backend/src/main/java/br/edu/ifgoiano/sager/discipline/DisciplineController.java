package br.edu.ifgoiano.sager.discipline;

import static br.edu.ifgoiano.sager.discipline.DisciplineModels.*;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@Profile("local")
@RequestMapping("/api/v1")
public class DisciplineController {
    private final DisciplineService service;
    public DisciplineController(DisciplineService service) { this.service=service; }
    @GetMapping("/notificacoes/contexto") public ResponseEntity<Context> context() { return ok(service.context()); }
    @GetMapping("/ocorrencias") public ResponseEntity<Page<Occurrence>> occurrences(@RequestParam(required=false) UUID residentId,@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.occurrences(residentId,limit,beforeSequence)); }
    @GetMapping("/ocorrencias/{id}") public ResponseEntity<Occurrence> occurrence(@PathVariable UUID id) { return ok(service.getOccurrence(id)); }
    @GetMapping("/notificacoes") public ResponseEntity<Page<Notification>> notifications(@RequestParam(required=false) UUID residentId,@RequestParam(required=false) String status,@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.notifications(residentId,status,limit,beforeSequence)); }
    @GetMapping("/notificacoes/{id}") public ResponseEntity<Notification> notification(@PathVariable UUID id) { return ok(service.getNotification(id)); }
    @PostMapping("/notificacoes/{id}/visualizar") public ResponseEntity<Notification> view(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.view(id,body)); }
    @PostMapping("/notificacoes/{id}/analisar") public ResponseEntity<Notification> analyze(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.analyze(id,body)); }
    @PostMapping("/notificacoes/{id}/arquivar") public ResponseEntity<Notification> archive(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.archive(id,body)); }
    @PostMapping("/notificacoes/{id}/converter") public ResponseEntity<Warning> convert(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.convert(id,body)); }
    @GetMapping("/advertencias") public ResponseEntity<Page<Warning>> warnings(@RequestParam(required=false) UUID residentId,@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.warnings(residentId,limit,beforeSequence)); }
    @GetMapping("/advertencias/{id}") public ResponseEntity<Warning> warning(@PathVariable UUID id) { return ok(service.getWarning(id)); }
    @PostMapping("/advertencias") public ResponseEntity<Warning> createWarning(@RequestBody JsonNode body) { return ok(service.createWarning(body)); }
    @PostMapping("/advertencias/{id}/anular") public ResponseEntity<Warning> annulWarning(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.annulWarning(id,body)); }
    @GetMapping("/residentes/{id}/reincidencias") public ResponseEntity<List<Recurrence>> recurrence(@PathVariable UUID id) { return ok(service.recurrence(id)); }
    @GetMapping("/residentes/{id}/termos") public ResponseEntity<Page<Term>> terms(@PathVariable UUID id,@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.terms(id,limit,beforeSequence)); }
    @PostMapping("/residentes/{id}/termos") public ResponseEntity<Term> issue(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.issueTerm(id,body)); }
    @GetMapping("/termos/{id}") public ResponseEntity<Term> term(@PathVariable UUID id) { return ok(service.getTerm(id)); }
    @PostMapping("/termos/{id}/anular") public ResponseEntity<Term> annulTerm(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.annulTerm(id,body)); }
    @GetMapping("/termos/{id}/documento") public ResponseEntity<byte[]> document(@PathVariable UUID id) { return file(id,false); }
    @GetMapping("/me/termos/{id}/documento") public ResponseEntity<byte[]> ownDocument(@PathVariable UUID id) { return file(id,true); }
    private ResponseEntity<byte[]> file(UUID id,boolean own) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_PDF).header("Content-Disposition","attachment; filename=\"sager-termo-"+id+".pdf\"").body(service.document(id,own)); }
    private <T> ResponseEntity<T> ok(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
}
