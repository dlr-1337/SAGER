package br.edu.ifgoiano.sager.management.residents;

import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
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
@RequestMapping("/api/v1/residentes")
public class ResidentController {
    private final ResidentService service;

    public ResidentController(ResidentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Resident>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resident> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Resident> create(@RequestBody CreateRequest request) {
        Resident created = service.create(text(request.name(), "name"),
                text(request.enrollment(), "enrollment"), birthDate(request.birthDate()),
                text(request.course(), "course"));
        return ResponseEntity.created(URI.create("/api/v1/residentes/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Resident> update(@PathVariable UUID id, @RequestBody UpdateRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id,
                text(request.name(), "name"), text(request.enrollment(), "enrollment"),
                birthDate(request.birthDate()), text(request.course(), "course"),
                version(request.version())));
    }

    @ExceptionHandler(ResidentApiException.class)
    public ResponseEntity<ApiError> apiError(ResidentApiException error) {
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
            throw invalidInput(field + " deve ser texto JSON.");
        }
        return value.stringValue();
    }

    private LocalDate birthDate(JsonNode value) {
        String text = text(value, "birthDate");
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException error) {
            throw invalidInput("birthDate deve ser uma data ISO válida.");
        }
    }

    private long version(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
        return value.asLong();
    }

    private ResidentApiException invalidInput(String message) {
        return new ResidentApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    public record CreateRequest(JsonNode name, JsonNode enrollment, JsonNode birthDate,
            JsonNode course) {
    }

    public record UpdateRequest(JsonNode name, JsonNode enrollment, JsonNode birthDate,
            JsonNode course, JsonNode version) {
    }

    public record ApiError(String code, String message) {
    }
}
