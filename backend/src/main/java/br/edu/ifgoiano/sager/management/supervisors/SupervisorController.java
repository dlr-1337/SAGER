package br.edu.ifgoiano.sager.management.supervisors;

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
@Profile({ "local", "production" })
@RequestMapping("/api/v1/supervisores")
public class SupervisorController {
    private final SupervisorService service;

    public SupervisorController(SupervisorService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Supervisor>> list(@org.springframework.web.bind.annotation.RequestParam java.util.Map<String,String> params) {
        var page = service.list(params);
        return ResponseEntity.ok().header("X-Total-Count", Long.toString(page.total())).cacheControl(CacheControl.noStore()).body(page.items());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Supervisor> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Supervisor> create(@RequestBody CreateSupervisorRequest request) {
        Supervisor created = service.create(text(request.name(), "name"),
                text(request.institutionalId(), "institutionalId"), text(request.email(), "email"),
                text(request.password(), "senha"),
                text(request.passwordConfirmation(), "confirmação de senha"));
        return ResponseEntity.created(URI.create("/api/v1/supervisores/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Supervisor> update(@PathVariable UUID id,
            @RequestBody UpdateSupervisorRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id,
                text(request.name(), "name"), text(request.institutionalId(), "institutionalId"),
                text(request.email(), "email"), version(request.version())));
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

    private long version(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
        return value.asLong();
    }

    private SupervisorApiException invalidInput(String message) {
        return new SupervisorApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    public record CreateSupervisorRequest(JsonNode name, JsonNode institutionalId, JsonNode email,
            JsonNode password, JsonNode passwordConfirmation) {
    }

    public record UpdateSupervisorRequest(JsonNode name, JsonNode institutionalId, JsonNode email,
            JsonNode version) {
    }

}
