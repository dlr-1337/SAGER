package br.edu.ifgoiano.sager.management.residents;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import br.edu.ifgoiano.sager.management.courses.CourseService;
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
public class ResidentService {
    private final ResidentRepository repository;
    private final AuditService audit;
    private final CourseService courses;
    private final LocalAccountProvisioningService accounts;

    public ResidentService(ResidentRepository repository, AuditService audit, CourseService courses, LocalAccountProvisioningService accounts) {
        this.repository = repository;
        this.audit = audit;
        this.courses = courses;
        this.accounts = accounts;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<Resident> list(java.util.Map<String,String> params) {
        return repository.search(params);
    }

    public List<Resident> list() {
        return repository.findAll();
    }

    public Resident get(UUID id) {
        return repository.findById(id).orElseThrow(() -> new ResidentApiException(
                HttpStatus.NOT_FOUND, "not_found", "Estudante não encontrado."));
    }

    @Transactional
    public Resident create(String name, String enrollment, LocalDate birthDate, UUID courseId, String institutionalEmail, String password, String passwordConfirmation) {
        String course = courses.selectedName(courseId, null);
        String email = checkedEmail(institutionalEmail);
        if (password == null || !password.equals(passwordConfirmation)) throw invalidInput("As senhas devem coincidir.");
        CheckedInput checked = checked(name, enrollment, birthDate, course);
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checked.name(), checked.enrollment(), birthDate, checked.course(), courseId, email);
            accounts.create(checked.enrollment(), null, checked.name(), "residente", password.toCharArray());
            accounts.linkResident(checked.enrollment(), id);
        } catch (IllegalArgumentException error) {
            if (error.getCause() instanceof org.springframework.dao.DuplicateKeyException)
                throw new ResidentApiException(HttpStatus.CONFLICT, "duplicate_enrollment", "Matrícula já utilizada por uma conta.");
            throw new ResidentApiException(HttpStatus.BAD_REQUEST, "invalid_input", error.getMessage());
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        audit.record(AuditResource.RESIDENT, id, AuditAction.CREATE, 0,
                Set.of("name", "enrollment", "birthDate", "courseId", "institutionalEmail"));
        return new Resident(id, checked.name(), checked.enrollment(), birthDate, checked.course(), 0, courseId, email);
    }

    @Transactional
    public Resident update(UUID id, String name, String enrollment, LocalDate birthDate,
            UUID courseId, String institutionalEmail, long version) {
        if (version < 0 || version == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
        Resident current = get(id);
        accounts.lockResidentAccount(id);
        String course = courses.selectedName(courseId, current.courseId());
        String email = checkedEmail(institutionalEmail);
        CheckedInput checked = checked(name, enrollment, birthDate, course);
        if (current.version() != version) {
            throw new ResidentApiException(HttpStatus.CONFLICT, "stale_version",
                    "O estudante foi alterado. Recarregue o registro antes de salvar.");
        }
        int updated;
        try {
            updated = repository.update(id, checked.name(), checked.enrollment(), birthDate,
                    checked.course(), courseId, email, version);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        if (updated == 0) {
            get(id);
            throw new ResidentApiException(HttpStatus.CONFLICT, "stale_version",
                    "O estudante foi alterado. Recarregue o registro antes de salvar.");
        }
        Set<String> changed = new HashSet<>();
        if (!Objects.equals(current.name(), checked.name())) {
            changed.add("name");
        }
        if (!Objects.equals(current.enrollment(), checked.enrollment())) {
            try {
                accounts.synchronizeResidentEnrollment(id, checked.enrollment());
            } catch (IllegalArgumentException error) {
                throw new ResidentApiException(HttpStatus.CONFLICT, "duplicate_enrollment",
                        "Matrícula já utilizada por uma conta.");
            }
            changed.add("enrollment");
        }
        if (!Objects.equals(current.birthDate(), birthDate)) {
            changed.add("birthDate");
        }
        if (!Objects.equals(current.course(), checked.course())) {
            changed.add("course");
        }
        if (!Objects.equals(current.courseId(), courseId)) changed.add("courseId");
        if (!Objects.equals(current.institutionalEmail(), email)) changed.add("institutionalEmail");
        audit.record(AuditResource.RESIDENT, id, AuditAction.UPDATE, version + 1, changed);
        return new Resident(id, checked.name(), checked.enrollment(), birthDate,
                checked.course(), version + 1, courseId, email);
    }

    private String checkedEmail(String value) {
        String email = optional(value, "institutionalEmail", 320);
        if (email == null) return null;
        if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw invalidInput("E-mail institucional inválido.");
        return email.toLowerCase(java.util.Locale.ROOT);
    }

    private CheckedInput checked(String name, String enrollment, LocalDate birthDate, String course) {
        String checkedName = required(name, "name", 3, 200);
        String checkedEnrollment = required(enrollment, "enrollment", 1, 64);
        try { LocalAccountProvisioningService.normalizeEnrollment(checkedEnrollment); }
        catch (IllegalArgumentException error) { throw invalidInput(error.getMessage()); }
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
