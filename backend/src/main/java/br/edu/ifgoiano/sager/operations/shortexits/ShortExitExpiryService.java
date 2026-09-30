package br.edu.ifgoiano.sager.operations.shortexits;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.operations.OperationResidents;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;

@Service
@Profile("local")
public class ShortExitExpiryService {
    private final ShortExitRepository exits;
    private final OperationResidents residents;
    private final AuditService audit;
    private final Clock clock;

    public ShortExitExpiryService(ShortExitRepository exits, OperationResidents residents,
            AuditService audit, Clock clock) {
        this.exits = exits;
        this.residents = residents;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public int expireDue() {
        if (RequestContextHolder.getRequestAttributes() != null) {
            throw new IllegalStateException("Expiração exige execução interna sem requisição HTTP.");
        }
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        UUID requestId = UUID.randomUUID();
        int expired = 0;
        for (UUID id : exits.due(now)) {
            ShortExit snapshot = exits.find(id, false).orElse(null);
            if (snapshot == null || !residents.lock(snapshot.residentId())) continue;
            ShortExit current = exits.find(id, true).orElse(null);
            if (current == null || current.deadline() == null || now.isBefore(current.deadline())) continue;
            String reason = ShortExit.APPROVED.equals(current.status()) ? "APPROVED_WITHOUT_DEPARTURE"
                    : "SCHEDULED".equals(current.departureMode()) ? "SCHEDULED_DEPARTURE_PASSED" : "RETURN_DEADLINE_PASSED";
            ShortExit updated = exits.update(id, current.version(),
                    Map.of("status", "EXPIRADA", "expiry_reason", reason), now);
            if (updated == null) continue;
            exits.history(updated, "EXPIRE", now, current.deadline(), null, null, "SYSTEM_JOB", null);
            audit.recordSystem(requestId, AuditResource.SHORT_EXIT, id, AuditAction.END,
                    updated.version(), Set.of("status", "expiryReason"));
            expired++;
        }
        return expired;
    }
}
