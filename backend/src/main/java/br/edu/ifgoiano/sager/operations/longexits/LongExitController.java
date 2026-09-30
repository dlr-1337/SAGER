package br.edu.ifgoiano.sager.operations.longexits;

import br.edu.ifgoiano.sager.operations.OpsInput;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@Profile("local")
@RequestMapping("/api/v1/saidas-longas")
public class LongExitController {
    private final LongExitService service;

    public LongExitController(LongExitService service) {
        this.service = service;
    }

    @GetMapping("/elegibilidade")
    public ResponseEntity<LongExitService.LongEligibility> eligibility() {
        return ok(service.eligibility());
    }

    @GetMapping
    public ResponseEntity<List<LongExit>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID residentId) {
        return ok(service.list(residentId, search, status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LongExit> get(@PathVariable UUID id) {
        return ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<LongExit> create(@RequestBody JsonNode body) {
        OpsInput.object(
                body,
                "departureMode",
                "requestedDepartureAt",
                "expectedReturnAt",
                "reason",
                "notes",
                "guardianId");
        LongExit created = service.create(plan(body));
        return ResponseEntity.created(URI.create("/api/v1/saidas-longas/" + created.id()))
                .cacheControl(CacheControl.noStore())
                .body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LongExit> update(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(
                body,
                "departureMode",
                "requestedDepartureAt",
                "expectedReturnAt",
                "reason",
                "notes",
                "guardianId",
                "version");
        return ok(service.update(id, OpsInput.version(body), plan(body)));
    }

    @PostMapping("/{id}/decisao")
    public ResponseEntity<LongExit> decide(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version", "decision", "documentVersionId", "comment");
        return ok(
                service.decide(
                        id,
                        OpsInput.version(body),
                        OpsInput.text(body, "decision", true, 1, 16),
                        uuid(body, "documentVersionId", false),
                        OpsInput.text(body, "comment", false, 1, 2000)));
    }

    @PostMapping("/{id}/cancelamento")
    public ResponseEntity<LongExit> cancel(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version", "comment");
        return ok(
                service.cancel(
                        id,
                        OpsInput.version(body),
                        OpsInput.text(body, "comment", true, 10, 2000)));
    }

    @PostMapping("/{id}/partida")
    public ResponseEntity<LongExit> depart(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version", "timeMode", "occurredAt", "justification");
        return ok(service.depart(id, OpsInput.version(body), physical(body)));
    }

    @PostMapping("/{id}/retorno")
    public ResponseEntity<LongExit> returnFromExit(
            @PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(
                body, "version", "timeMode", "occurredAt", "justification", "lateObservation");
        return ok(
                service.returnFromExit(
                        id,
                        OpsInput.version(body),
                        physical(body),
                        OpsInput.text(body, "lateObservation", false, 1, 2000)));
    }

    @PostMapping("/{id}/reenvio")
    public ResponseEntity<LongExit> resend(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version", "guardianId", "comment");
        return ok(
                service.resend(
                        id,
                        OpsInput.version(body),
                        uuid(body, "guardianId", false),
                        OpsInput.text(body, "comment", true, 10, 2000)));
    }

    @PostMapping("/{id}/reconciliacao")
    public ResponseEntity<LongExit> reconcile(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version");
        return ok(service.reconcile(id, OpsInput.version(body)));
    }

    @GetMapping("/{id}/documentos/{documentVersionId}/original")
    public ResponseEntity<byte[]> original(
            @PathVariable UUID id, @PathVariable UUID documentVersionId) {
        return download(service.download(id, documentVersionId, false));
    }

    @GetMapping("/{id}/documentos/{documentVersionId}/assinado")
    public ResponseEntity<byte[]> signed(
            @PathVariable UUID id, @PathVariable UUID documentVersionId) {
        return download(service.download(id, documentVersionId, true));
    }

    private LongExitService.Plan plan(JsonNode body) {
        String mode = OpsInput.text(body, "departureMode", true, 1, 16);
        if ("NOW".equals(mode) && body.has("requestedDepartureAt"))
            throw OpsInput.invalid("NOW usa somente o relógio do servidor.");
        return new LongExitService.Plan(
                mode,
                OpsInput.instant(body, "requestedDepartureAt", false),
                OpsInput.instant(body, "expectedReturnAt", true),
                OpsInput.text(body, "reason", true, 3, 2000),
                OpsInput.text(body, "notes", false, 1, 2000),
                uuid(body, "guardianId", true));
    }

    private LongExitService.PhysicalTime physical(JsonNode body) {
        return new LongExitService.PhysicalTime(
                OpsInput.text(body, "timeMode", true, 1, 16),
                OpsInput.instant(body, "occurredAt", false),
                OpsInput.text(body, "justification", false, 1, 2000));
    }

    private UUID uuid(JsonNode body, String key, boolean required) {
        String value = OpsInput.text(body, key, required, 36, 36);
        if (value == null) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw OpsInput.invalid("UUID inválido: " + key + ".");
        }
    }

    private <T> ResponseEntity<T> ok(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    private ResponseEntity<byte[]> download(LongExitService.Download d) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_PDF)
                .header("X-Content-Type-Options", "nosniff")
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + d.filename() + "\"")
                .body(d.bytes());
    }
}
