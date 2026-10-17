package br.edu.ifgoiano.sager.management.guardians;

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
public class GuardianService {
    private final GuardianRepository repository;
    private final AuditService audit;

    public GuardianService(GuardianRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<Guardian> list(java.util.Map<String,String> params) {
        return repository.search(params);
    }

    public List<Guardian> list() {
        return repository.findAll();
    }

    public Guardian get(UUID id) {
        return repository.findById(id).orElseThrow(() -> new GuardianApiException(
                HttpStatus.NOT_FOUND, "not_found", "Responsável não encontrado."));
    }

    @Transactional
    public Guardian create(UUID residentId, String name, String relationship, String phone,
            Boolean active) {
        CheckedInput checked = checked(residentId, name, relationship, phone, active);
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checked.residentId(), checked.name(), checked.relationship(),
                    checked.phone(), checked.active());
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        audit.record(AuditResource.GUARDIAN, id, AuditAction.CREATE, 0,
                Set.of("residentId", "name", "relationship", "phone", "active"));
        return new Guardian(id, checked.residentId(), checked.name(), checked.relationship(),
                checked.phone(), checked.active(), 0);
    }

    @Transactional
    public Guardian update(UUID id, UUID residentId, String name, String relationship,
            String phone, Boolean active, long version) {
        Guardian current = get(id);
        CheckedInput checked = checked(residentId, name, relationship, phone, active);
        if (current.version() != version) {
            throw new GuardianApiException(HttpStatus.CONFLICT, "stale_version",
                    "O responsável foi alterado. Recarregue o registro antes de salvar.");
        }
        int updated;
        try {
            updated = repository.update(id, checked.residentId(), checked.name(),
                    checked.relationship(), checked.phone(), checked.active(), version);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        if (updated == 0) {
            get(id);
            throw new GuardianApiException(HttpStatus.CONFLICT, "stale_version",
                    "O responsável foi alterado. Recarregue o registro antes de salvar.");
        }
        Set<String> changed = new HashSet<>();
        if (!Objects.equals(current.residentId(), checked.residentId())) {
            changed.add("residentId");
        }
        if (!Objects.equals(current.name(), checked.name())) {
            changed.add("name");
        }
        if (!Objects.equals(current.relationship(), checked.relationship())) {
            changed.add("relationship");
        }
        if (!Objects.equals(current.phone(), checked.phone())) {
            changed.add("phone");
        }
        if (current.active() != checked.active()) {
            changed.add("active");
        }
        audit.record(AuditResource.GUARDIAN, id, AuditAction.UPDATE, version + 1, changed);
        return new Guardian(id, checked.residentId(), checked.name(), checked.relationship(),
                checked.phone(), checked.active(), version + 1);
    }

    private CheckedInput checked(UUID residentId, String name, String relationship,
            String phone, Boolean active) {
        if (residentId == null) {
            throw invalidInput("residentId é obrigatório.");
        }
        String checkedName = required(name, "name", 3, 200);
        String checkedRelationship = required(relationship, "relationship", 2, 80);
        String checkedPhone = optional(phone, "phone", 30);
        if (active == null) {
            throw invalidInput("active é obrigatório.");
        }
        if (!repository.residentExists(residentId)) {
            throw invalidReference();
        }
        return new CheckedInput(residentId, checkedName, checkedRelationship,
                checkedPhone, active);
    }

    private String required(String value, String field, int minLength, int maxLength) {
        if (value == null) {
            throw invalidInput(field + " é obrigatório.");
        }
        String checked = stripEdgeSpaces(value);
        if (checked.length() < minLength || checked.length() > maxLength
                || checked.chars().anyMatch(Character::isISOControl)) {
            throw invalidInput(field + " tem formato ou tamanho inválido.");
        }
        return checked;
    }

    private String optional(String value, String field, int maxLength) {
        if (value == null) {
            return null;
        }
        String checked = stripEdgeSpaces(value);
        if (checked.isEmpty()) {
            return null;
        }
        if (checked.length() > maxLength || checked.chars().anyMatch(Character::isISOControl)) {
            throw invalidInput(field + " tem formato ou tamanho inválido.");
        }
        return checked;
    }

    private String stripEdgeSpaces(String value) {
        int start = 0;
        int end = value.length();
        while (start < end && isSpace(value.codePointAt(start))) {
            start += Character.charCount(value.codePointAt(start));
        }
        while (end > start && isSpace(value.codePointBefore(end))) {
            end -= Character.charCount(value.codePointBefore(end));
        }
        return value.substring(start, end);
    }

    private boolean isSpace(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint);
    }

    private RuntimeException integrityError(DataIntegrityViolationException error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23503".equals(sql.getSQLState())) {
                return invalidReference();
            }
        }
        return error;
    }

    private GuardianApiException invalidReference() {
        return new GuardianApiException(HttpStatus.UNPROCESSABLE_CONTENT, "invalid_reference",
                "Estudante vinculado não encontrado.");
    }

    private GuardianApiException invalidInput(String message) {
        return new GuardianApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    private record CheckedInput(UUID residentId, String name, String relationship,
            String phone, boolean active) {
    }
}
