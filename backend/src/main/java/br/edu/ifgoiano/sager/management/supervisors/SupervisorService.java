package br.edu.ifgoiano.sager.management.supervisors;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.management.FieldRules;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
public class SupervisorService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final SupervisorRepository repository;
    private final AuditService audit;
    private final br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService accounts;

    public SupervisorService(SupervisorRepository repository, AuditService audit, br.edu.ifgoiano.sager.auth.LocalAccountProvisioningService accounts) {
        this.repository = repository;
        this.audit = audit; this.accounts = accounts;
    }

    public br.edu.ifgoiano.sager.management.ManagementSearch.Page<Supervisor> list(java.util.Map<String,String> params) {
        return repository.search(params);
    }

    public List<Supervisor> list() {
        return repository.findAll();
    }

    public Supervisor get(UUID id) {
        return repository.findById(id).orElseThrow(() ->
                new SupervisorApiException(HttpStatus.NOT_FOUND, "not_found",
                        "Supervisor não encontrado."));
    }

    @Transactional
    public Supervisor create(String name, String institutionalId, String email, String password,
            String passwordConfirmation) {
        String checkedName = checkedName(required(name, "name", 200), null);
        String checkedId = checkedId(required(institutionalId, "institutionalId", 64), null);
        String checkedEmail = validEmail(email);
        if (password == null || !password.equals(passwordConfirmation)) {
            throw badRequest("As senhas devem coincidir.");
        }
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checkedName, checkedId, checkedEmail);
            // O e-mail é único na conta e não no supervisor: repeti-lo daria um conflito falso.
            accounts.create(checkedId, null, checkedName, "supervisor", password.toCharArray());
            accounts.linkSupervisor(checkedId, id);
        } catch (IllegalArgumentException error) {
            if (error.getCause() instanceof DuplicateKeyException) {
                throw new SupervisorApiException(HttpStatus.CONFLICT, "duplicate_enrollment",
                        "Usuário já utilizado por uma conta.");
            }
            throw badRequest(error.getMessage());
        } catch (DataIntegrityViolationException error) {
            throw duplicateId();
        }
        audit.record(AuditResource.SUPERVISOR, id, AuditAction.CREATE, 0,
                Set.of("name", "institutionalId", "email"));
        return new Supervisor(id, checkedName, checkedId, checkedEmail, 0);
    }

    @Transactional
    public Supervisor update(UUID id, String name, String institutionalId, String email,
            Long version) {
        String typedName = required(name, "name", 200);
        String typedId = required(institutionalId, "institutionalId", 64);
        String checkedEmail = validEmail(email);
        if (version == null || version < 0 || version == Long.MAX_VALUE) {
            throw badRequest("version deve ser um inteiro não negativo válido.");
        }
        Supervisor current = get(id);
        String checkedName = checkedName(typedName, current);
        String checkedId = checkedId(typedId, current);
        accounts.lockSupervisorAccount(id);
        if (current.version() != version) {
            throw new SupervisorApiException(HttpStatus.CONFLICT, "stale_version",
                    "O supervisor foi alterado. Recarregue o registro antes de salvar.");
        }
        int updated;
        try {
            updated = repository.update(id, checkedName, checkedId, checkedEmail, version);
        } catch (DataIntegrityViolationException error) {
            throw duplicateId();
        }
        if (updated == 0) {
            get(id);
            throw new SupervisorApiException(HttpStatus.CONFLICT, "stale_version",
                    "O supervisor foi alterado. Recarregue o registro antes de salvar.");
        }
        Set<String> changed = new HashSet<>();
        if (!Objects.equals(current.name(), checkedName)) {
            changed.add("name");
        }
        if (!Objects.equals(current.institutionalId(), checkedId)) {
            try {
                accounts.synchronizeSupervisorEnrollment(id, checkedId);
            } catch (IllegalArgumentException error) {
                throw new SupervisorApiException(HttpStatus.CONFLICT, "duplicate_enrollment",
                        "Usuário já utilizado por uma conta ou inválido para acesso.");
            }
            changed.add("institutionalId");
        }
        if (!Objects.equals(current.email(), checkedEmail)) {
            changed.add("email");
        }
        audit.record(AuditResource.SUPERVISOR, id, AuditAction.UPDATE, version + 1, changed);
        return new Supervisor(id, checkedName, checkedId, checkedEmail, version + 1);
    }

    private String checkedName(String typed, Supervisor current) {
        if (current != null && typed.equals(current.name())) return typed;
        String normalized = FieldRules.normalizeName(typed);
        if (!FieldRules.validName(normalized)) throw badRequest("Digite o nome completo, como no documento.");
        return normalized;
    }

    private String checkedId(String typed, Supervisor current) {
        if (current != null && typed.equals(current.institutionalId())) return typed;
        if (!FieldRules.validSupervisorId(typed)) throw badRequest("Use de 4 a 20 letras, números ou hífen.");
        return typed;
    }

    private String validEmail(String value) {
        String checked = required(value, "email", 320).toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(checked).matches()) {
            throw badRequest("email deve ter um endereço válido.");
        }
        return checked;
    }

    private String required(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) {
            throw badRequest(field + " é obrigatório.");
        }
        String checked = value.trim();
        if (checked.length() > maxLength || checked.chars().anyMatch(Character::isISOControl)) {
            throw badRequest(field + " tem formato ou tamanho inválido.");
        }
        return checked;
    }

    private SupervisorApiException badRequest(String message) {
        return new SupervisorApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    private SupervisorApiException duplicateId() {
        return new SupervisorApiException(HttpStatus.CONFLICT, "duplicate_institutional_id",
                "Usuário já cadastrado.");
    }
}
