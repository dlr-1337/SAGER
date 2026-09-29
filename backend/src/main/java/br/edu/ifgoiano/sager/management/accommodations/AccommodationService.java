package br.edu.ifgoiano.sager.management.accommodations;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@Profile("local")
public class AccommodationService {
    private final AccommodationRepository repository;

    public AccommodationService(AccommodationRepository repository) {
        this.repository = repository;
    }

    public List<Accommodation> list() {
        return repository.findAll();
    }

    public Accommodation get(UUID id) {
        return repository.findById(id).orElseThrow(() -> notFound("Alojamento não encontrado."));
    }

    public Accommodation create(String code, String name) {
        String checkedCode = required(code, "code", 64);
        String checkedName = required(name, "name", 200);
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checkedCode, checkedName);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        return new Accommodation(id, checkedCode, checkedName, 0);
    }

    public Accommodation update(UUID id, String code, String name, long version) {
        String checkedCode = required(code, "code", 64);
        String checkedName = required(name, "name", 200);
        validVersion(version);
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
        return new AccommodationUnit(id, accommodationId, checkedCode, checkedName, 0);
    }

    public AccommodationUnit updateUnit(UUID accommodationId, UUID unitId, String code,
            String name, long version) {
        String checkedCode = required(code, "code", 64);
        String checkedName = required(name, "name", 200);
        validVersion(version);
        get(accommodationId);
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
