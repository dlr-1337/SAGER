package br.edu.ifgoiano.sager.management.rooms;

import java.sql.SQLException;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.management.FieldRules;
import br.edu.ifgoiano.sager.management.accommodations.AccommodationRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
public class RoomService {
    // Ocupado is derived from capacity and active allocations (RoomRepository), never stored.
    private static final Set<String> SITUATIONS = Set.of("Disponível", "Manutenção", "Indisponível");
    private final RoomRepository repository;
    private final AccommodationRepository accommodations;
    private final AuditService audit;

    public RoomService(RoomRepository repository, AccommodationRepository accommodations,
            AuditService audit) {
        this.repository = repository;
        this.accommodations = accommodations;
        this.audit = audit;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<RoomRecord> list(java.util.Map<String,String> params) {
        return repository.search(params);
    }

    public List<RoomRecord> list() {
        return repository.findAll();
    }

    public RoomRecord get(UUID id) {
        return repository.findById(id).orElseThrow(() -> new RoomApiException(HttpStatus.NOT_FOUND,
                "not_found", "Quarto não encontrado."));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public RoomMap map() {
        return new RoomMap(accommodations.findAll(), accommodations.findAllUnits(), repository.findAll());
    }

    @Transactional
    public RoomRecord create(String code, String number, UUID accommodationId, UUID unitId,
            String floor, Integer capacity, String situation) {
        CheckedInput checked = checked(code, number, accommodationId, unitId, floor, capacity, situation);
        if (capacity != null && !FieldRules.validCapacity(capacity)) throw invalidCapacity();
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checked.code(), checked.number(), accommodationId, unitId,
                    checked.floor(), capacity, checked.situation());
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        audit.record(AuditResource.ROOM, id, AuditAction.CREATE, 0,
                Set.of("code", "number", "accommodationId", "unitId", "floor", "capacity", "situation"));
        return get(id);
    }

    @Transactional
    public RoomRecord update(UUID id, String code, String number, UUID accommodationId, UUID unitId,
            String floor, Integer capacity, String situation, long version) {
        if (version < 0 || version == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
        CheckedInput checked = checked(code, number, accommodationId, unitId, floor, capacity, situation);
        RoomRecord current = repository.findByIdForUpdate(id).orElseThrow(() ->
                new RoomApiException(HttpStatus.NOT_FOUND, "not_found", "Quarto não encontrado."));
        if (current.version() != version) {
            throw new RoomApiException(HttpStatus.CONFLICT, "stale_version",
                    "O quarto foi alterado. Recarregue o registro antes de salvar.");
        }
        if (capacity != null && !capacity.equals(current.capacity()) && !FieldRules.validCapacity(capacity)) {
            throw invalidCapacity();
        }
        int active = repository.activeCount(id);
        if (active > 0 && (capacity == null || capacity < active)) {
            throw new RoomApiException(HttpStatus.CONFLICT, "capacity_below_occupancy",
                    "A capacidade não pode ser removida nem ficar abaixo da ocupação ativa.");
        }
        int updated;
        try {
            updated = repository.update(id, checked.code(), checked.number(), accommodationId, unitId,
                    checked.floor(), capacity, checked.situation(), version);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        if (updated == 0) {
            get(id);
            throw new RoomApiException(HttpStatus.CONFLICT, "stale_version",
                    "O quarto foi alterado. Recarregue o registro antes de salvar.");
        }
        Set<String> changed = new HashSet<>();
        if (!Objects.equals(current.code(), checked.code())) {
            changed.add("code");
        }
        if (!Objects.equals(current.number(), checked.number())) {
            changed.add("number");
        }
        if (!Objects.equals(current.accommodationId(), accommodationId)) {
            changed.add("accommodationId");
        }
        if (!Objects.equals(current.unitId(), unitId)) {
            changed.add("unitId");
        }
        if (!Objects.equals(current.floor(), checked.floor())) {
            changed.add("floor");
        }
        if (!Objects.equals(current.capacity(), capacity)) {
            changed.add("capacity");
        }
        String currentSituation = "Ocupado".equals(current.situation()) ? "Disponível" : current.situation();
        if (!Objects.equals(currentSituation, checked.situation())) {
            changed.add("situation");
        }
        audit.record(AuditResource.ROOM, id, AuditAction.UPDATE, version + 1, changed);
        return get(id);
    }

    private CheckedInput checked(String code, String number, UUID accommodationId, UUID unitId,
            String floor, Integer capacity, String situation) {
        String checkedCode = required(code, "code");
        String checkedNumber = required(number, "number");
        String checkedFloor = optionalFloor(floor);
        if (capacity != null && capacity <= 0) {
            throw invalidInput("capacity deve ser um inteiro positivo ou null.");
        }
        String checkedSituation = required(situation, "situation");
        if (!SITUATIONS.contains(checkedSituation)) {
            throw invalidInput("situation deve ser Disponível, Manutenção ou Indisponível."
                    + " Ocupado é calculado pela capacidade e pelos moradores ativos.");
        }
        if (accommodationId == null) {
            throw invalidInput("accommodationId é obrigatório.");
        }
        if (accommodations.findById(accommodationId).isEmpty()
                || (unitId != null && accommodations.findUnit(accommodationId, unitId).isEmpty())) {
            throw invalidLocation();
        }
        return new CheckedInput(checkedCode, checkedNumber, checkedFloor, checkedSituation);
    }

    private RoomApiException invalidCapacity() {
        return invalidInput("A capacidade deve ficar entre 1 e 20.");
    }

    private String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw invalidInput(field + " é obrigatório.");
        }
        String checked = value.trim();
        if (checked.length() > 64 || checked.chars().anyMatch(Character::isISOControl)) {
            throw invalidInput(field + " tem formato ou tamanho inválido.");
        }
        return checked;
    }

    private String optionalFloor(String value) {
        if (value == null) {
            return null;
        }
        if (value.chars().anyMatch(Character::isISOControl)) {
            throw invalidInput("floor tem formato ou tamanho inválido.");
        }
        String checked = value.trim();
        if (checked.isBlank()) {
            return null;
        }
        if (checked.length() > 64) {
            throw invalidInput("floor tem formato ou tamanho inválido.");
        }
        return checked;
    }

    private RuntimeException integrityError(DataIntegrityViolationException error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) {
                String message = sql.getMessage();
                if ("23505".equals(sql.getSQLState()) && message != null) {
                    if (message.contains("\"sager_room_code_unique\"")) {
                        return new RoomApiException(HttpStatus.CONFLICT, "duplicate_code",
                                "Código global do quarto já cadastrado.");
                    }
                    if (message.contains("\"sager_room_location_unique\"")) {
                        return new RoomApiException(HttpStatus.CONFLICT, "duplicate_location",
                                "Número do quarto já cadastrado nesta localização.");
                    }
                }
                if ("23503".equals(sql.getSQLState())) {
                    return invalidLocation();
                }
                if ("23514".equals(sql.getSQLState())) {
                    return invalidInput("Os dados do quarto violam uma regra de cadastro.");
                }
            }
        }
        return error;
    }

    private RoomApiException invalidInput(String message) {
        return new RoomApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    private RoomApiException invalidLocation() {
        return new RoomApiException(HttpStatus.BAD_REQUEST, "invalid_location",
                "Alojamento ou unidade inválidos. A unidade deve pertencer ao alojamento informado.");
    }

    private record CheckedInput(String code, String number, String floor, String situation) {
    }
}
