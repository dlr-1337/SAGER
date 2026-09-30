package br.edu.ifgoiano.sager.integrations;

import br.edu.ifgoiano.sager.documents.PrivateFileException;
import br.edu.ifgoiano.sager.documents.PrivateFileStore;
import br.edu.ifgoiano.sager.integrations.IntegrationRepository.BindingData;
import br.edu.ifgoiano.sager.operations.longexits.LongExit;
import br.edu.ifgoiano.sager.operations.longexits.LongExitApiException;
import br.edu.ifgoiano.sager.operations.longexits.LongExitGuardians;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.DocumentRow;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository.Row;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
@Profile({ "local", "production" })
public class SignatureAccessService {
    private final JdbcTemplate jdbc;
    private final IntegrationRepository integrations;
    private final LongExitRepository exits;
    private final LongExitGuardians guardians;
    private final PrivateFileStore files;
    private final Clock clock;

    public SignatureAccessService(
            JdbcTemplate jdbc,
            IntegrationRepository integrations,
            LongExitRepository exits,
            LongExitGuardians guardians,
            PrivateFileStore files,
            Clock clock) {
        this.jdbc = jdbc;
        this.integrations = integrations;
        this.exits = exits;
        this.guardians = guardians;
        this.files = files;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Access get(String authorization) {
        Validated v = validate(authorization);
        BindingData b = v.binding();
        Row e = v.exit();
        DocumentRow d = exits.document(b.documentVersionId());
        boolean widget =
                "PENDING".equals(b.status()) && "DONE".equals(b.stage()) && b.signerId() != null;
        return new Access(
                b.id(),
                d.id(),
                d.revision(),
                e.residentName(),
                e.enrollment(),
                b.guardianName(),
                b.guardianRelationship(),
                e.requestedDepartureAt(),
                e.expectedReturnAt(),
                e.reason(),
                e.notes(),
                b.status(),
                b.expiresAt(),
                clock.instant(),
                new Widget(
                        widget,
                        widget ? b.signerId() : null,
                        widget ? b.environment() : null,
                        "2.1.0"));
    }

    @Transactional(readOnly = true)
    public byte[] document(String authorization) {
        Validated v = validate(authorization);
        try {
            return files.openVerified(exits.document(v.binding().documentVersionId()).original());
        } catch (PrivateFileException error) {
            throw new LongExitApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "document_unavailable",
                    "Documento privado indisponível.");
        }
    }

    private Validated validate(String authorization) {
        if (authorization == null || !authorization.matches("Bearer [A-Za-z0-9_-]{43}"))
            throw denied();
        String hash = CapabilityTokens.hash(authorization.substring(7));
        UUID id =
                jdbc
                        .query(
                                "SELECT id FROM sager_signature_binding WHERE token_hash=?",
                                (r, n) -> r.getObject(1, UUID.class),
                                hash)
                        .stream()
                        .findFirst()
                        .orElseThrow(this::denied);
        BindingData b = integrations.binding(id, false).orElseThrow(this::denied);
        Instant now = clock.instant();
        Row e = exits.find(b.exitId(), false).orElseThrow(this::denied);
        if (b.revokedAt() != null
                || !now.isBefore(b.expiresAt())
                || !e.documentVersionId().equals(b.documentVersionId())
                || (!"PENDING".equals(b.status()) && !"VALID".equals(b.status()))
                || !LongExit.PENDING.equals(e.status())
                || (e.deadline() != null && !now.isBefore(e.deadline()))
                || guardians.list(e.residentId()).stream()
                        .noneMatch(
                                g ->
                                        g.id().equals(b.guardianId())
                                                && g.eligible()
                                                && g.version() == b.guardianVersion()
                                                && g.phone().equals(b.guardianPhone())
                                                && g.name().equals(b.guardianName())
                                                && g.relationship()
                                                        .equals(b.guardianRelationship())))
            throw denied();
        return new Validated(b, e);
    }

    private LongExitApiException denied() {
        return new LongExitApiException(
                HttpStatus.UNAUTHORIZED,
                "invalid_capability",
                "Convite inválido, revogado ou expirado.");
    }

    private record Validated(BindingData binding, Row exit) {}

    public record Widget(
            boolean available, UUID signerId, String environment, String libraryVersion) {}

    public record Access(
            UUID bindingId,
            UUID documentVersionId,
            int revisionNumber,
            String residentName,
            String enrollment,
            String guardianName,
            String guardianRelationship,
            Instant requestedDepartureAt,
            Instant expectedReturnAt,
            String reason,
            String notes,
            String signatureStatus,
            Instant expiresAt,
            Instant now,
            Widget widget) {}
}
