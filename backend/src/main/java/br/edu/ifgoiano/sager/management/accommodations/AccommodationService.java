package br.edu.ifgoiano.sager.management.accommodations;

import java.sql.SQLException;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
public class AccommodationService {
    private final AccommodationRepository repository;
    private final AuditService audit;

    public AccommodationService(AccommodationRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<Accommodation> list(java.util.Map<String,String> params) {
        return repository.search(params);
    }

    public List<Accommodation> list() {
        return repository.findAll();
    }

    public Accommodation get(UUID id) {
        return repository.findById(id).orElseThrow(() -> notFound("Alojamento não encontrado."));
    }

    @Transactional
    public Accommodation create(String code, String name) {
        String checkedCode = required(code, "code", 64);
        String checkedName = required(name, "name", 200);
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checkedCode, checkedName);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        audit.record(AuditResource.ACCOMMODATION, id, AuditAction.CREATE, 0, Set.of("code", "name"));
        return new Accommodation(id, checkedCode, checkedName, 0);
    }

    @Transactional
    public Accommodation update(UUID id, String code, String name, long version) {
        String checkedCode = required(code, "code", 64);
        String checkedName = required(name, "name", 200);
        validVersion(version);
        Accommodation current = get(id);
        if (current.version() != version) {
            throw staleVersion("O alojamento foi alterado. Recarregue antes de salvar.");
        }
        int updated;
        try {
            updated = repository.update(id, checkedCode, checkedName, version);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        if (updated == 0) {
            get(id);
            throw staleVersion("O alojamento foi alterado. Recarregue antes de salvar.");
        }
        Set<String> changed = new HashSet<>();
        if (!Objects.equals(current.code(), checkedCode)) {
            changed.add("code");
        }
        if (!Objects.equals(current.name(), checkedName)) {
            changed.add("name");
        }
        audit.record(AuditResource.ACCOMMODATION, id, AuditAction.UPDATE, version + 1, changed);
        return new Accommodation(id, checkedCode, checkedName, version + 1);
    }

    public List<AccommodationUnit> listUnits(UUID accommodationId) {
        get(accommodationId);
        return repository.findUnits(accommodationId);
    }

    public AccommodationUnit getUnit(UUID accommodationId, UUID unitId) {
        get(accommodationId);
        return repository.findUnit(accommodationId, unitId).orElseThrow(() ->
                notFound("Unidade não encontrada neste alojamento."));
    }

    @Transactional
    public AccommodationUnit createUnit(UUID accommodationId, String code, String name) {
        String checkedCode = required(code, "code", 64);
        String checkedName = required(name, "name", 200);
        get(accommodationId);
        UUID id = UUID.randomUUID();
        try {
            repository.insertUnit(id, accommodationId, checkedCode, checkedName);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        audit.record(AuditResource.ACCOMMODATION_UNIT, id, AuditAction.CREATE, 0,
                Set.of("accommodationId", "code", "name"));
        return new AccommodationUnit(id, accommodationId, checkedCode, checkedName, 0);
    }

    @Transactional
    public AccommodationUnit updateUnit(UUID accommodationId, UUID unitId, String code,
            String name, long version) {
        String checkedCode = required(code, "code", 64);
        String checkedName = required(name, "name", 200);
        validVersion(version);
        AccommodationUnit current = getUnit(accommodationId, unitId);
        if (current.version() != version) {
            throw staleVersion("A unidade foi alterada. Recarregue antes de salvar.");
        }
        int updated;
        try {
            updated = repository.updateUnit(unitId, accommodationId, checkedCode, checkedName, version);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        if (updated == 0) {
            getUnit(accommodationId, unitId);
            throw staleVersion("A unidade foi alterada. Recarregue antes de salvar.");
        }
        Set<String> changed = new HashSet<>();
        if (!Objects.equals(current.code(), checkedCode)) {
            changed.add("code");
        }
        if (!Objects.equals(current.name(), checkedName)) {
            changed.add("name");
        }
        audit.record(AuditResource.ACCOMMODATION_UNIT, unitId, AuditAction.UPDATE, version + 1, changed);
        return new AccommodationUnit(unitId, accommodationId, checkedCode, checkedName, version + 1);
    }

    private String required(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) {
            throw invalidInput(field + " é obrigatório.");
        }
        String checked = value.trim();
        if (checked.length() > maxLength || checked.chars().anyMatch(Character::isISOControl)) {
            throw invalidInput(field + " tem formato ou tamanho inválido.");
        }
        return checked;
    }

    private void validVersion(long version) {
        if (version < 0 || version == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
    }

    private RuntimeException integrityError(DataIntegrityViolationException error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) {
                String message = sql.getMessage();
                if ("23505".equals(sql.getSQLState()) && message != null
                        && (message.contains("\"sager_accommodation_code_unique\"")
                        || message.contains("\"sager_accommodation_unit_code_unique\""))) {
                    return new AccommodationApiException(HttpStatus.CONFLICT, "duplicate_code",
                            "Código já cadastrado nesta localização.");
                }
                if ("23503".equals(sql.getSQLState())) {
                    return new AccommodationApiException(HttpStatus.BAD_REQUEST, "invalid_location",
                            "O alojamento informado não está disponível.");
                }
            }
        }
        return error;
    }

    private AccommodationApiException invalidInput(String message) {
        return new AccommodationApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    private AccommodationApiException notFound(String message) {
        return new AccommodationApiException(HttpStatus.NOT_FOUND, "not_found", message);
    }

    private AccommodationApiException staleVersion(String message) {
        return new AccommodationApiException(HttpStatus.CONFLICT, "stale_version", message);
    }
}
