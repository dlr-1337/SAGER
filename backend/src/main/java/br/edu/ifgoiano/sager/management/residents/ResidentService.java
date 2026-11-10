package br.edu.ifgoiano.sager.management.residents;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService;
import br.edu.ifgoiano.sager.management.FieldRules;
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
        if (courseId == null) throw invalidInput("courseId é obrigatório.");
        String course = courses.selectedName(courseId, null);
        String email = checkedEmail(institutionalEmail, null);
        if (password == null || !password.equals(passwordConfirmation)) throw invalidInput("As senhas devem coincidir.");
        CheckedInput checked = checked(name, enrollment, birthDate, course, null);
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
        if (courseId == null) throw invalidInput("courseId é obrigatório.");
        String course = courses.selectedName(courseId, current.courseId());
        String email = checkedEmail(institutionalEmail, current.institutionalEmail());
        CheckedInput checked = checked(name, enrollment, birthDate, course, current);
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

    private String checkedEmail(String value, String saved) {
        String email = optional(value, "institutionalEmail", 320);
        if (email == null) return null;
        String lower = email.toLowerCase(java.util.Locale.ROOT);
        if (saved != null && lower.equals(saved.toLowerCase(java.util.Locale.ROOT))) return saved;
        if (!FieldRules.validResidentEmail(lower)) {
            throw invalidInput("Use o e-mail institucional, que termina em @estudante.ifgoiano.edu.br.");
        }
        return lower;
    }

    private CheckedInput checked(String name, String enrollment, LocalDate birthDate, String course, Resident current) {
        String checkedName = checkedName(required(name, "name", 3, 200), current);
        String checkedEnrollment = checkedEnrollment(required(enrollment, "enrollment", 1, 64), current);
        String checkedCourse = optional(course, "course", 200);
        if (birthDate == null) {
            throw invalidInput("birthDate é obrigatório.");
        }
        if ((current == null || !birthDate.equals(current.birthDate())) && !FieldRules.plausibleBirthDate(birthDate)) {
            throw invalidInput("Confira a data de nascimento.");
        }
        return new CheckedInput(checkedName, checkedEnrollment, checkedCourse);
    }

    private String checkedName(String typed, Resident current) {
        if (current != null && formatName(typed).equals(current.name())) return current.name();
        String normalized = FieldRules.normalizeName(typed);
        if (!FieldRules.validName(normalized)) throw invalidInput("Digite o nome completo, como no documento.");
        return formatName(normalized);
    }

    private String checkedEnrollment(String typed, Resident current) {
        String normalized = FieldRules.normalizeEnrollment(typed);
        if (current != null && (typed.equals(current.enrollment()) || normalized.equals(current.enrollment()))) {
            return current.enrollment();
        }
        if (!FieldRules.validResidentEnrollment(normalized)) throw invalidInput("Confira a matrícula no SUAP.");
        return normalized;
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

    private static boolean isSpace(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint);
    }

    // Migration V22 applies this same rule to existing names; keep both aligned.
    static String formatName(String value) {
        StringBuilder formatted = new StringBuilder(value.length());
        boolean wordStart = true;
        for (int codePoint : value.codePoints().toArray()) {
            formatted.appendCodePoint(wordStart ? Character.toUpperCase(codePoint) : Character.toLowerCase(codePoint));
            wordStart = isSpace(codePoint) || codePoint == '-' || codePoint == '\'' || codePoint == '’';
        }
        return formatted.toString();
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
