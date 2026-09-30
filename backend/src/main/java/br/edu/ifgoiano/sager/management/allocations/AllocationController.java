package br.edu.ifgoiano.sager.management.allocations;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import tools.jackson.databind.JsonNode;

@RestController
@Profile("local")
@RequestMapping("/api/v1/alocacoes")
public class AllocationController {
    private final AllocationService service;

    public AllocationController(AllocationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Allocation>> list(@RequestParam(required = false) UUID residentId,
            @RequestParam(required = false) UUID roomId, @RequestParam(required = false) Boolean active) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.list(residentId, roomId, active));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Allocation> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Allocation> create(@RequestBody CreateRequest request) {
        Allocation created = service.create(uuid(request.residentId(), "residentId"),
                uuid(request.roomId(), "roomId"));
        return ResponseEntity.created(URI.create("/api/v1/alocacoes/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PostMapping("/{id}/transferir")
    public ResponseEntity<Allocation> transfer(@PathVariable UUID id, @RequestBody ChangeRequest request) {
        Allocation created = service.transfer(id, uuid(request.roomId(), "roomId"), version(request.version()));
        return ResponseEntity.created(URI.create("/api/v1/alocacoes/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PostMapping("/{id}/encerrar")
    public ResponseEntity<Allocation> end(@PathVariable UUID id, @RequestBody EndRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.end(id, version(request.version())));
    }

    @ExceptionHandler(AllocationApiException.class)
    public ResponseEntity<ApiError> apiError(AllocationApiException error) {
        return ResponseEntity.status(error.status()).cacheControl(CacheControl.noStore())
                .body(new ApiError(error.code(), error.getMessage()));
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class })
    public ResponseEntity<ApiError> malformedRequest(Exception error) {
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .body(new ApiError("invalid_input", "Corpo JSON ou ID inválido."));
    }

    private UUID uuid(JsonNode value, String field) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isString()) {
            throw invalidInput(field + " deve ser um UUID válido.");
        }
        try {
            return UUID.fromString(value.stringValue());
        } catch (IllegalArgumentException error) {
            throw invalidInput(field + " deve ser um UUID válido.");
        }
    }

    private long version(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
        return value.asLong();
    }

    private AllocationApiException invalidInput(String message) {
        return new AllocationApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    public record CreateRequest(JsonNode residentId, JsonNode roomId) {
    }

    public record ChangeRequest(JsonNode roomId, JsonNode version) {
    }

    public record EndRequest(JsonNode version) {
    }

    public record ApiError(String code, String message) {
    }
}
