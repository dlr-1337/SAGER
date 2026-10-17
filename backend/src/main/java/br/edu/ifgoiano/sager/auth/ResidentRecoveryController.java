package br.edu.ifgoiano.sager.auth;
import java.time.LocalDate;
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
    public ResponseEntity<Void> recover(@RequestParam String matricula, @RequestParam String name,
            @RequestParam String birthDate, @RequestParam(required=false) String guardianName,
            @RequestParam String password, @RequestParam String passwordConfirmation, HttpServletRequest request) {
        if (!limits.allowRecovery(matricula, request.getRemoteAddr())) return ResponseEntity.status(429).header("Retry-After", "900").cacheControl(CacheControl.noStore()).build();
        LocalDate date;
        try { date = LocalDate.parse(birthDate); }
        catch (java.time.format.DateTimeParseException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Confira os dados informados."); }
        service.recover(matricula, name, date, guardianName, password, passwordConfirmation);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
