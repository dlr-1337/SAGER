package br.edu.ifgoiano.sager.management.guardians;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@Profile("local")
@RequestMapping("/api/v1/responsaveis")
public class GuardianController {
    private final GuardianService service;

    public GuardianController(GuardianService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Guardian>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Guardian> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Guardian> create(@RequestBody CreateRequest request) {
        Guardian created = service.create(residentId(request.residentId()),
                text(request.name(), "name"), text(request.relationship(), "relationship"),
                text(request.phone(), "phone"), active(request.active()));
        return ResponseEntity.created(URI.create("/api/v1/responsaveis/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Guardian> update(@PathVariable UUID id, @RequestBody UpdateRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id,
                residentId(request.residentId()), text(request.name(), "name"),
                text(request.relationship(), "relationship"), text(request.phone(), "phone"),
                active(request.active()), version(request.version())));
    }

    private UUID residentId(JsonNode value) {
        String text = text(value, "residentId");
        if (text == null) {
            return null;
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException error) {
            throw invalidInput("residentId deve ser um UUID válido.");
        }
    }

    private String text(JsonNode value, String field) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isString()) {
            throw invalidInput(field + " deve ser texto JSON.");
        }
        return value.stringValue();
    }

    private Boolean active(JsonNode value) {
        if (value == null || !value.isBoolean()) {
            throw invalidInput("active deve ser booleano.");
        }
        return value.booleanValue();
    }

    private long version(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
        return value.asLong();
    }

    private GuardianApiException invalidInput(String message) {
        return new GuardianApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    public record CreateRequest(JsonNode residentId, JsonNode name, JsonNode relationship,
            JsonNode phone, JsonNode active) {
    }

    public record UpdateRequest(JsonNode residentId, JsonNode name, JsonNode relationship,
            JsonNode phone, JsonNode active, JsonNode version) {
    }

}
