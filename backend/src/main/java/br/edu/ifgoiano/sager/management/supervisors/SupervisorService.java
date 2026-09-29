package br.edu.ifgoiano.sager.management.supervisors;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@Profile("local")
public class SupervisorService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final SupervisorRepository repository;

    public SupervisorService(SupervisorRepository repository) {
        this.repository = repository;
    }

    public List<Supervisor> list() {
        return repository.findAll();
    }

    public Supervisor get(UUID id) {
        return repository.findById(id).orElseThrow(() ->
                new SupervisorApiException(HttpStatus.NOT_FOUND, "not_found",
                        "Supervisor não encontrado."));
    }

    public Supervisor create(String name, String institutionalId, String email) {
        String checkedName = required(name, "name", 200);
        String checkedId = required(institutionalId, "institutionalId", 64);
        String checkedEmail = validEmail(email);
        UUID id = UUID.randomUUID();
        try {
            repository.insert(id, checkedName, checkedId, checkedEmail);
        } catch (DataIntegrityViolationException error) {
            throw duplicateId();
        }
        return new Supervisor(id, checkedName, checkedId, checkedEmail, 0);
    }

    public Supervisor update(UUID id, String name, String institutionalId, String email,
            Long version) {
        String checkedName = required(name, "name", 200);
        String checkedId = required(institutionalId, "institutionalId", 64);
        String checkedEmail = validEmail(email);
        if (version == null || version < 0 || version == Long.MAX_VALUE) {
            throw badRequest("version deve ser um inteiro não negativo válido.");
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
        return new Supervisor(id, checkedName, checkedId, checkedEmail, version + 1);
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
                "Identificação institucional já cadastrada.");
    }
}
