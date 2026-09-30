package br.edu.ifgoiano.sager.operations.nightcalls;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import br.edu.ifgoiano.sager.operations.OpsInput;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@Profile("local")
@RequestMapping("/api/v1/chamadas")
public class NightCallController {
    private final NightCallService service;

    public NightCallController(NightCallService service) {
        this.service = service;
    }

    @GetMapping("/contexto")
    public ResponseEntity<NightCall.Context> context(@RequestParam(required = false) UUID accommodationId) {
        return ok(service.context(accommodationId));
    }

    @GetMapping
    public ResponseEntity<List<NightCall>> list(@RequestParam(required = false) UUID accommodationId,
            @RequestParam(required = false) LocalDate date) {
        return ok(service.list(accommodationId, date));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NightCall> get(@PathVariable UUID id) {
        return ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<NightCall> open(@RequestBody JsonNode body) {
        OpsInput.object(body, "accommodationId", "outsideWindowConfirmed", "justification");
        NightCall created = service.open(OpsInput.uuid(body, "accommodationId"),
                OpsInput.bool(body, "outsideWindowConfirmed"), OpsInput.text(body, "justification", false, 1, 2000));
        return ResponseEntity.created(URI.create("/api/v1/chamadas/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}/registros/{residentId}")
    public ResponseEntity<NightCall> mark(@PathVariable UUID id, @PathVariable UUID residentId,
            @RequestBody JsonNode body) {
        OpsInput.object(body, "mark", "version", "authorizedExitId", "authorizedExitType");
        return ok(service.mark(id, residentId, OpsInput.version(body), OpsInput.text(body, "mark", true, 1, 32),
                optionalExitId(body), OpsInput.text(body, "authorizedExitType", false, 1, 8), null, false));
    }

    @PostMapping("/{id}/correcoes/{residentId}")
    public ResponseEntity<NightCall> correct(@PathVariable UUID id, @PathVariable UUID residentId,
            @RequestBody JsonNode body) {
        OpsInput.object(body, "mark", "version", "authorizedExitId", "authorizedExitType", "justification");
        return ok(service.mark(id, residentId, OpsInput.version(body), OpsInput.text(body, "mark", true, 1, 32),
                optionalExitId(body), OpsInput.text(body, "authorizedExitType", false, 1, 8),
                OpsInput.text(body, "justification", true, 10, 2000), true));
    }

    @PostMapping("/{id}/fechamento")
    public ResponseEntity<NightCall> close(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version", "outsideWindowConfirmed", "justification");
        return ok(service.close(id, OpsInput.version(body), OpsInput.bool(body, "outsideWindowConfirmed"),
                OpsInput.text(body, "justification", false, 1, 2000)));
    }

    private UUID optionalExitId(JsonNode body) {
        JsonNode value = body.get("authorizedExitId");
        return value == null || value.isNull() ? null : OpsInput.uuid(body, "authorizedExitId");
    }

    private <T> ResponseEntity<T> ok(T value) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
    }
}
