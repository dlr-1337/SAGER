package br.edu.ifgoiano.sager.management.accommodations;

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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import tools.jackson.databind.JsonNode;

@RestController
@Profile("local")
@RequestMapping("/api/v1/alojamentos")
public class AccommodationController {
    private final AccommodationService service;

    public AccommodationController(AccommodationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Accommodation>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Accommodation> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Accommodation> create(@RequestBody CreateRequest request) {
        Accommodation created = service.create(text(request.code(), "code"), text(request.name(), "name"));
        return ResponseEntity.created(URI.create("/api/v1/alojamentos/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Accommodation> update(@PathVariable UUID id,
            @RequestBody UpdateRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id,
                text(request.code(), "code"), text(request.name(), "name"), version(request.version())));
    }

    @GetMapping("/{id}/unidades")
    public ResponseEntity<List<AccommodationUnit>> units(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.listUnits(id));
    }

    @GetMapping("/{id}/unidades/{unitId}")
    public ResponseEntity<AccommodationUnit> unit(@PathVariable UUID id, @PathVariable UUID unitId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.getUnit(id, unitId));
    }

    @PostMapping("/{id}/unidades")
    public ResponseEntity<AccommodationUnit> createUnit(@PathVariable UUID id,
            @RequestBody CreateRequest request) {
        AccommodationUnit created = service.createUnit(id, text(request.code(), "code"), text(request.name(), "name"));
        return ResponseEntity.created(URI.create("/api/v1/alojamentos/" + id + "/unidades/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}/unidades/{unitId}")
    public ResponseEntity<AccommodationUnit> updateUnit(@PathVariable UUID id, @PathVariable UUID unitId,
            @RequestBody UpdateRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.updateUnit(id,
                unitId, text(request.code(), "code"), text(request.name(), "name"), version(request.version())));
    }

    @ExceptionHandler(AccommodationApiException.class)
    public ResponseEntity<ApiError> apiError(AccommodationApiException error) {
        return ResponseEntity.status(error.status()).cacheControl(CacheControl.noStore())
                .body(new ApiError(error.code(), error.getMessage()));
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class })
    public ResponseEntity<ApiError> malformedRequest(Exception error) {
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .body(new ApiError("invalid_input", "Corpo JSON ou ID inválido."));
    }

    private String text(JsonNode value, String field) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isString()) {
            throw new AccommodationApiException(HttpStatus.BAD_REQUEST, "invalid_input",
                    field + " deve ser texto JSON.");
        }
        return value.stringValue();
    }

    private long version(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE) {
            throw new AccommodationApiException(HttpStatus.BAD_REQUEST, "invalid_input",
                    "version deve ser um inteiro não negativo válido.");
        }
        return value.asLong();
    }

    public record CreateRequest(JsonNode code, JsonNode name) {
    }

    public record UpdateRequest(JsonNode code, JsonNode name, JsonNode version) {
    }

    public record ApiError(String code, String message) {
    }
}
