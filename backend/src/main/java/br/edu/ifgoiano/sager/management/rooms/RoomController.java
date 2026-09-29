package br.edu.ifgoiano.sager.management.rooms;

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
@RequestMapping("/api/v1/quartos")
public class RoomController {
    private final RoomService service;

    public RoomController(RoomService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<RoomRecord>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list());
    }

    @GetMapping("/mapa")
    public ResponseEntity<RoomMap> map() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.map());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoomRecord> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<RoomRecord> create(@RequestBody CreateRequest request) {
        RoomRecord created = service.create(text(request.code(), "code"), text(request.number(), "number"),
                request.accommodationId(), request.unitId(), text(request.floor(), "floor"),
                capacity(request.capacity()), text(request.situation(), "situation"));
        return ResponseEntity.created(URI.create("/api/v1/quartos/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RoomRecord> update(@PathVariable UUID id, @RequestBody UpdateRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id,
                text(request.code(), "code"), text(request.number(), "number"), request.accommodationId(),
                request.unitId(), text(request.floor(), "floor"), capacity(request.capacity()),
                text(request.situation(), "situation"), version(request.version())));
    }

    @ExceptionHandler(RoomApiException.class)
    public ResponseEntity<ApiError> apiError(RoomApiException error) {
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
            throw new RoomApiException(HttpStatus.BAD_REQUEST, "invalid_input",
                    field + " deve ser texto JSON.");
        }
        return value.stringValue();
    }

    private Integer capacity(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isIntegralNumber() || !value.canConvertToInt() || value.asInt() <= 0) {
            throw new RoomApiException(HttpStatus.BAD_REQUEST, "invalid_input",
                    "capacity deve ser um inteiro positivo ou null.");
        }
        return value.asInt();
    }

    private long version(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE) {
            throw new RoomApiException(HttpStatus.BAD_REQUEST, "invalid_input",
                    "version deve ser um inteiro não negativo válido.");
        }
        return value.asLong();
    }

    public record CreateRequest(JsonNode code, JsonNode number, UUID accommodationId, UUID unitId,
            JsonNode floor, JsonNode capacity, JsonNode situation) {
    }

    public record UpdateRequest(JsonNode code, JsonNode number, UUID accommodationId, UUID unitId,
            JsonNode floor, JsonNode capacity, JsonNode situation, JsonNode version) {
    }

    public record ApiError(String code, String message) {
    }
}
