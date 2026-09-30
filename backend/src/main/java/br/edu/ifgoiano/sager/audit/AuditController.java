package br.edu.ifgoiano.sager.audit;

import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("local")
@RequestMapping("/api/v1/auditoria")
public class AuditController {
    private final AuditService service;

    public AuditController(AuditService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<AuditPage> list(@RequestParam(required = false) UUID resourceId,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) UUID requestId,
            @RequestParam(required = false) AuditResource resource,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) Long beforeSequence) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
                service.list(resourceId, actorId, requestId, resource, limit, beforeSequence));
    }
}
