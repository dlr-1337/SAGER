package br.edu.ifgoiano.sager.operations.longexits;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository;
import br.edu.ifgoiano.sager.operations.OperationResidents;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Profile({ "local", "production" })
public class LongExitExpiryService {
    private final LongExitRepository exits;
    private final IntegrationRepository integrations;
    private final OperationResidents residents;
    private final AuditService audit;
    private final Clock clock;

    public LongExitExpiryService(
            LongExitRepository exits,
            IntegrationRepository integrations,
            OperationResidents residents,
            AuditService audit,
            Clock clock) {
        this.exits = exits;
        this.integrations = integrations;
        this.residents = residents;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public int expireDue() {
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        UUID correlation = UUID.randomUUID();
        int changed = 0;
        for (UUID id : exits.due(now)) {
            var old = exits.find(id, false).orElseThrow();
            residents.lock(old.residentId());
            var current = exits.find(id, true).orElseThrow();
            if (current.deadline() == null || now.isBefore(current.deadline())) continue;
            String reason =
                    LongExit.APPROVED.equals(current.status())
                            ? "APPROVED_WITHOUT_DEPARTURE"
                            : "SCHEDULED".equals(current.departureMode())
                                    ? "SCHEDULED_DEPARTURE_PASSED"
                                    : "PENDING_RETURN_PASSED";
            var updated =
                    exits.update(
                            current, Map.of("status", "EXPIRADA", "expiry_reason", reason), now);
            exits.history(updated, "EXPIRE", now, null, null, null, "SYSTEM_JOB", null);
            audit.recordSystem(
                    correlation,
                    AuditResource.LONG_EXIT,
                    id,
                    AuditAction.END,
                    updated.version(),
                    Set.of("status", "expiryReason"));
            for (UUID bindingId : integrations.invalidate(id, null, now)) {
                integrations.cancelPendingTasks(bindingId, now);
                var binding = integrations.binding(bindingId, false).orElseThrow();
                audit.recordSystem(
                        correlation,
                        AuditResource.SIGNATURE_BINDING,
                        bindingId,
                        AuditAction.END,
                        binding.version(),
                        Set.of("status", "revokedAt"));
            }
            changed++;
        }
        return changed;
    }
}
