package br.edu.ifgoiano.sager.management.courses;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
@RestController
@Profile({"local", "production"})
@RequestMapping("/api/v1/cursos")
public class CourseController {
    private final CourseService service;
    public CourseController(CourseService service) { this.service = service; }
    @GetMapping public ResponseEntity<List<Course>> list() { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list()); }
    @PostMapping public ResponseEntity<Course> create(@RequestBody Request input) {
        Course course = service.save(null, name(input), true, null);
        return ResponseEntity.created(URI.create("/api/v1/cursos/" + course.id())).cacheControl(CacheControl.noStore()).body(course);
    }
    @PutMapping("/{id}") public ResponseEntity<Course> update(@PathVariable UUID id, @RequestBody Request input) {
        if (input.active() == null || !input.active().isBoolean() || input.version() == null || !input.version().isIntegralNumber() || !input.version().canConvertToLong()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.save(id, name(input), input.active().asBoolean(), input.version().asLong()));
    }
    private String name(Request input) {
        if (input.name() == null || !input.name().isString()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return input.name().stringValue();
    }
    public record Request(JsonNode name, JsonNode active, JsonNode version) {}
}
