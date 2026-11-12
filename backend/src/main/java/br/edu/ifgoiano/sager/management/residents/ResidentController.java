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
@RequestMapping("/api/v1/residentes")
public class ResidentController {
    private final ResidentService service;

    public ResidentController(ResidentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Resident>> list(@org.springframework.web.bind.annotation.RequestParam java.util.Map<String,String> params) {
        var page = service.list(params);
        return ResponseEntity.ok().header("X-Total-Count", Long.toString(page.total())).cacheControl(CacheControl.noStore()).body(page.items());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resident> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Resident> create(@RequestBody CreateRequest request) {
        Resident created = service.create(text(request.name(), "name"),
                text(request.enrollment(), "enrollment"), birthDate(request.birthDate()),
                courseId(request.courseId()), text(request.institutionalEmail(), "institutionalEmail"),
                integer(request.entryYear(), "entryYear"), extraSemesters(request.extraSemesters()),
                text(request.password(), "password"), text(request.passwordConfirmation(), "passwordConfirmation"));
        return ResponseEntity.created(URI.create("/api/v1/residentes/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Resident> update(@PathVariable UUID id, @RequestBody UpdateRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id,
                text(request.name(), "name"), text(request.enrollment(), "enrollment"),
                birthDate(request.birthDate()), courseId(request.courseId()), text(request.institutionalEmail(), "institutionalEmail"),
                integer(request.entryYear(), "entryYear"), extraSemesters(request.extraSemesters()),
                version(request.version())));
    }

    private Integer integer(JsonNode value, String field) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isIntegralNumber() || !value.canConvertToInt()) {
            throw invalidInput(field + " deve ser um inteiro JSON.");
        }
        return value.asInt();
    }

    private int extraSemesters(JsonNode value) {
        Integer semesters = integer(value, "extraSemesters");
        return semesters == null ? 0 : semesters;
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

    private UUID courseId(JsonNode value) {
        String text = text(value, "courseId");
        if (text == null) return null;
        try { return UUID.fromString(text); }
        catch (IllegalArgumentException error) { throw invalidInput("courseId deve ser UUID válido."); }
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
            JsonNode courseId, JsonNode institutionalEmail, JsonNode entryYear, JsonNode extraSemesters,
            JsonNode password, JsonNode passwordConfirmation) {
    }

    public record UpdateRequest(JsonNode name, JsonNode enrollment, JsonNode birthDate,
            JsonNode courseId, JsonNode institutionalEmail, JsonNode entryYear, JsonNode extraSemesters,
            JsonNode version) {
    }

}
