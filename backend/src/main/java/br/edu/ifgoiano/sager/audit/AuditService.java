package br.edu.ifgoiano.sager.audit;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("local")
public class AuditService {
    private final AuditRepository repository;
    private final AuditContextProvider contextProvider;

    public AuditService(AuditRepository repository, AuditContextProvider contextProvider) {
        this.repository = repository;
        this.contextProvider = contextProvider;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuditResource resource, UUID resourceId, AuditAction action,
            long resultingVersion, Set<String> changedFields) {
        AuditContextProvider.Context context = contextProvider.requireContext();
        if (resource == null || resourceId == null || action == null || resultingVersion < 0
                || changedFields == null || changedFields.stream().anyMatch(field -> field == null
                        || !resource.fields().contains(field))) {
            throw new IllegalArgumentException("Metadados de auditoria inválidos.");
        }
        repository.insert(context, resource, resourceId, action, resultingVersion,
                changedFields.stream().sorted().toList());
    }

    @Transactional(readOnly = true)
    public AuditPage list(UUID resourceId, UUID actorId, UUID requestId, AuditResource resource,
            int limit, Long beforeSequence) {
        if (limit < 1 || limit > 100 || (beforeSequence != null && beforeSequence <= 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Informe limite entre 1 e 100 e cursor positivo.");
        }
        List<AuditEvent> events = repository.find(resourceId, actorId, requestId, resource,
                beforeSequence, limit + 1);
        boolean hasNext = events.size() > limit;
        List<AuditEvent> items = hasNext ? events.subList(0, limit) : events;
        Long nextCursor = hasNext ? items.getLast().sequence() : null;
        return new AuditPage(items, nextCursor);
    }
}
