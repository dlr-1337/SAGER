package br.edu.ifgoiano.sager.management.residents;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@Profile("local")
public class ResidentService {
    private final ResidentRepository repository;

    public ResidentService(ResidentRepository repository) {
        this.repository = repository;
    }

    public List<Resident> list() {
        return repository.findAll();
    }

    public Resident get(UUID id) {
        return repository.findById(id).orElseThrow(() -> new ResidentApiException(
                HttpStatus.NOT_FOUND, "not_found", "Estudante não encontrado."));
    }

    public Resident create(String name, String enrollment, LocalDate birthDate, String course) {
        CheckedInput checked = checked(name, enrollment, birthDate, course);
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checked.name(), checked.enrollment(), birthDate, checked.course());
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        return new Resident(id, checked.name(), checked.enrollment(), birthDate, checked.course(), 0);
    }

    public Resident update(UUID id, String name, String enrollment, LocalDate birthDate,
            String course, long version) {
        if (version < 0 || version == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
        CheckedInput checked = checked(name, enrollment, birthDate, course);
        int updated;
        try {
            updated = repository.update(id, checked.name(), checked.enrollment(), birthDate,
                    checked.course(), version);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        if (updated == 0) {
            get(id);
            throw new ResidentApiException(HttpStatus.CONFLICT, "stale_version",
                    "O estudante foi alterado. Recarregue o registro antes de salvar.");
        }
        return new Resident(id, checked.name(), checked.enrollment(), birthDate,
                checked.course(), version + 1);
    }

    private CheckedInput checked(String name, String enrollment, LocalDate birthDate, String course) {
        String checkedName = required(name, "name", 3, 200);
        String checkedEnrollment = required(enrollment, "enrollment", 1, 64);
        String checkedCourse = optional(course, "course", 200);
        if (birthDate == null) {
            throw invalidInput("birthDate é obrigatório.");
        }
        if (birthDate.isAfter(LocalDate.now())) {
            throw invalidInput("birthDate não pode ser futura.");
        }
        return new CheckedInput(checkedName, checkedEnrollment, checkedCourse);
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
        while (start < end) {
            int codePoint = value.codePointAt(start);
            if (!isSpace(codePoint)) {
                break;
            }
            start += Character.charCount(codePoint);
        }
        while (end > start) {
            int codePoint = value.codePointBefore(end);
            if (!isSpace(codePoint)) {
                break;
            }
            end -= Character.charCount(codePoint);
        }
        return value.substring(start, end);
    }

    private boolean isSpace(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint);
    }

    private RuntimeException integrityError(DataIntegrityViolationException error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())
                    && sql.getMessage() != null
                    && sql.getMessage().contains("sager_resident_enrollment_unique")) {
                return new ResidentApiException(HttpStatus.CONFLICT, "duplicate_enrollment",
                        "Matrícula já cadastrada.");
            }
        }
        return error;
    }

    private ResidentApiException invalidInput(String message) {
        return new ResidentApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    private record CheckedInput(String name, String enrollment, String course) {
    }
}
