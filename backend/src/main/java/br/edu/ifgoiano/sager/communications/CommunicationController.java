package br.edu.ifgoiano.sager.communications;

import static br.edu.ifgoiano.sager.communications.CommunicationModels.*;
import java.util.UUID;
import br.edu.ifgoiano.sager.discipline.DisciplineModels.Page;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@Profile("local")
@RequestMapping("/api/v1")
public class CommunicationController {
    private final CommunicationService service;
    public CommunicationController(CommunicationService service) { this.service=service; }
    @GetMapping("/avisos") public ResponseEntity<Page<Notice>> notices(@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.notices(limit,beforeSequence)); }
    @GetMapping("/avisos/{id}") public ResponseEntity<Notice> notice(@PathVariable UUID id) { return ok(service.getNotice(id)); }
    @PostMapping("/avisos") public ResponseEntity<Notice> create(@RequestBody JsonNode body) { return ok(service.createNotice(body)); }
    @PostMapping("/avisos/{id}/publicar") public ResponseEntity<Notice> publish(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.publishNotice(id,body,false)); }
    @PostMapping("/avisos/{id}/revisar") public ResponseEntity<Notice> revise(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.publishNotice(id,body,true)); }
    @PostMapping("/avisos/{id}/retirar") public ResponseEntity<Notice> withdraw(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.withdrawNotice(id,body)); }
    @GetMapping("/me/avisos") public ResponseEntity<Page<Communication>> ownNotices(@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.ownList("AVISO",limit,beforeSequence)); }
    @GetMapping("/me/advertencias") public ResponseEntity<Page<Communication>> ownWarnings(@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.ownList("ADVERTENCIA",limit,beforeSequence)); }
    @GetMapping("/me/termos") public ResponseEntity<Page<Communication>> ownTerms(@RequestParam(defaultValue="20") int limit,@RequestParam(required=false) Long beforeSequence) { return ok(service.ownList("TERMO",limit,beforeSequence)); }
    @GetMapping("/me/comunicacoes/{id}") public ResponseEntity<Communication> own(@PathVariable UUID id) { return ok(service.own(id)); }
    @PostMapping("/me/comunicacoes/{id}/leitura") public ResponseEntity<Communication> read(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.acknowledge(id,body,true)); }
    @PostMapping("/me/comunicacoes/{id}/ciencia") public ResponseEntity<Communication> acknowledge(@PathVariable UUID id,@RequestBody JsonNode body) { return ok(service.acknowledge(id,body,false)); }
    private <T> ResponseEntity<T> ok(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
}
