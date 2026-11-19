package br.edu.ifgoiano.sager.pending;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile({ "local", "production" })
@RequestMapping("/api/v1/me/pendencias")
public class PendingController {
    private final PendingService service;

    public PendingController(PendingService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PendingService.Counts> counts() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.counts());
    }
}
