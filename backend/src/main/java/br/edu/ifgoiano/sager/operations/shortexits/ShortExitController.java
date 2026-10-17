package br.edu.ifgoiano.sager.operations.shortexits;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import br.edu.ifgoiano.sager.operations.OperationResidents.Eligibility;
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
@Profile({ "local", "production" })
@RequestMapping("/api/v1/saidas-curtas")
public class ShortExitController {
    private final ShortExitService service;

    public ShortExitController(ShortExitService service) {
        this.service = service;
    }

    @GetMapping("/elegibilidade")
    public ResponseEntity<Eligibility> eligibility() {
        return ok(service.eligibility());
    }

    @GetMapping
    public ResponseEntity<List<ShortExit>> list(@RequestParam java.util.Map<String,String> filters) {
        var page=service.list(filters);
        return ResponseEntity.ok().header("X-Total-Count",Long.toString(page.total())).cacheControl(CacheControl.noStore()).body(page.items());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ShortExit> get(@PathVariable UUID id) {
        return ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<ShortExit> create(@RequestBody JsonNode body) {
        OpsInput.object(body, "departureMode", "requestedDepartureAt", "expectedReturnAt", "reason", "notes");
        ShortExit created = service.create(plan(body));
        return ResponseEntity.created(URI.create("/api/v1/saidas-curtas/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShortExit> update(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "departureMode", "requestedDepartureAt", "expectedReturnAt", "reason", "notes", "version");
        return ok(service.update(id, OpsInput.version(body), plan(body)));
    }

    @PostMapping("/{id}/decisao")
    public ResponseEntity<ShortExit> decide(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "decision", "comment", "version");
        return ok(service.decide(id, OpsInput.version(body), OpsInput.text(body, "decision", true, 1, 16),
                OpsInput.text(body, "comment", false, 1, 2000)));
    }

    @PostMapping("/{id}/cancelamento")
    public ResponseEntity<ShortExit> cancel(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "comment", "version");
        return ok(service.cancel(id, OpsInput.version(body), OpsInput.text(body, "comment", true, 10, 2000)));
    }

    @PostMapping("/{id}/partida")
    public ResponseEntity<ShortExit> depart(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version", "timeMode", "occurredAt", "justification");
        return ok(service.depart(id, OpsInput.version(body), physical(body)));
    }

    @PostMapping("/{id}/retorno")
    public ResponseEntity<ShortExit> returnFromExit(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "version", "timeMode", "occurredAt", "justification", "lateObservation");
        return ok(service.returnFromExit(id, OpsInput.version(body), physical(body),
                OpsInput.text(body, "lateObservation", false, 1, 2000)));
    }

    private ShortExitService.Plan plan(JsonNode body) {
        String mode = OpsInput.text(body, "departureMode", true, 1, 16);
        if ("NOW".equals(mode) && body.has("requestedDepartureAt")) {
            throw OpsInput.invalid("NOW usa somente o horário do servidor.");
        }
        return new ShortExitService.Plan(mode, OpsInput.instant(body, "requestedDepartureAt", false),
                OpsInput.instant(body, "expectedReturnAt", true), OpsInput.text(body, "reason", true, 3, 2000),
                OpsInput.text(body, "notes", false, 1, 2000));
    }

    private ShortExitService.PhysicalTime physical(JsonNode body) {
        return new ShortExitService.PhysicalTime(OpsInput.text(body, "timeMode", true, 1, 16),
                OpsInput.instant(body, "occurredAt", false), OpsInput.text(body, "justification", false, 1, 2000));
    }

    private <T> ResponseEntity<T> ok(T result) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
    }
}
