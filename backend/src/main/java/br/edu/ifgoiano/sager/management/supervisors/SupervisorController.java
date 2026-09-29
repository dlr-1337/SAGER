package br.edu.ifgoiano.sager.management.supervisors;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
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

@RestController
@Profile("local")
@RequestMapping("/api/v1/supervisores")
public class SupervisorController {
    private final SupervisorService service;

    public SupervisorController(SupervisorService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Supervisor>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Supervisor> get(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Supervisor> create(@RequestBody CreateSupervisorRequest request) {
        Supervisor created = service.create(request.name(), request.institutionalId(),
                request.email());
        return ResponseEntity.created(URI.create("/api/v1/supervisores/" + created.id()))
                .cacheControl(CacheControl.noStore()).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Supervisor> update(@PathVariable UUID id,
            @RequestBody UpdateSupervisorRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(id,
                request.name(), request.institutionalId(), request.email(), request.version()));
    }

    @ExceptionHandler(SupervisorApiException.class)
    public ResponseEntity<ApiError> apiError(SupervisorApiException error) {
        return ResponseEntity.status(error.status()).cacheControl(CacheControl.noStore())
                .body(new ApiError(error.code(), error.getMessage()));
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class })
    public ResponseEntity<ApiError> malformedRequest(Exception error) {
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .body(new ApiError("invalid_input", "Corpo JSON ou ID inválido."));
    }

    public record CreateSupervisorRequest(String name, String institutionalId, String email) {
    }

    public record UpdateSupervisorRequest(String name, String institutionalId, String email,
            Long version) {
    }

    public record ApiError(String code, String message) {
    }
}
