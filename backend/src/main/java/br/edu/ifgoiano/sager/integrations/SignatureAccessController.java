package br.edu.ifgoiano.sager.integrations;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("local")
@RequestMapping("/api/v1/assinaturas")
public class SignatureAccessController {
    private final SignatureAccessService service;

    public SignatureAccessController(SignatureAccessService service) {
        this.service = service;
    }

    @GetMapping("/acesso")
    public ResponseEntity<SignatureAccessService.Access> get(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Referrer-Policy", "no-referrer")
                .body(service.get(authorization));
    }

    @GetMapping("/documento")
    public ResponseEntity<byte[]> document(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Referrer-Policy", "no-referrer")
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline; filename=\"autorizacao.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(service.document(authorization));
    }
}
