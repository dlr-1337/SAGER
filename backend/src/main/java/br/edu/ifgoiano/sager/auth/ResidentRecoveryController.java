package br.edu.ifgoiano.sager.auth;
import java.time.LocalDate;
import br.edu.ifgoiano.sager.api.ApiErrors;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
@Profile({"local", "production"})
public class ResidentRecoveryController {
    private final ResidentRecoveryService service;
    private final LoginRateLimiter limits;
    public ResidentRecoveryController(ResidentRecoveryService service, LoginRateLimiter limits) { this.service = service; this.limits = limits; }
    @PostMapping("/api/v1/auth/recover")
    public ResponseEntity<?> recover(@RequestParam String matricula, @RequestParam String name,
            @RequestParam String birthDate, @RequestParam(required=false) String guardianName,
            @RequestParam String password, @RequestParam String passwordConfirmation, HttpServletRequest request) {
        if (!limits.allowRecovery(matricula, request.getRemoteAddr())) {
            var limited = ApiErrors.response(request, HttpStatus.TOO_MANY_REQUESTS, "rate_limited",
                    "Muitas tentativas. Aguarde e tente novamente.");
            return ResponseEntity.status(limited.getStatusCode()).headers(limited.getHeaders())
                    .header(HttpHeaders.RETRY_AFTER, "900").body(limited.getBody());
        }
        LocalDate date;
        try { date = LocalDate.parse(birthDate); }
        catch (java.time.format.DateTimeParseException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Confira os dados informados."); }
        service.recover(matricula, name, date, guardianName, password, passwordConfirmation);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
