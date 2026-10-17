package br.edu.ifgoiano.sager.auth;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
public class LocalAccountProvisioningService {
    private static final Set<String> PROFILES = Set.of("gestor", "supervisor", "residente", "saude");

    private final LocalAccountRepository accounts;
    private final PasswordEncoder passwords;

    public LocalAccountProvisioningService(LocalAccountRepository accounts, PasswordEncoder passwords) {
        this.accounts = accounts;
        this.passwords = passwords;
    }

    public java.util.List<LocalAccount> list() { return accounts.findAll(); }

    @Transactional
    public void create(String enrollment, String email, String name, String profile, char[] password) {
        String normalizedEnrollment = normalizeEnrollment(enrollment);
        String normalizedEmail = email == null || email.isBlank() ? null : normalizeEmail(email);
        String normalizedName = requireName(name);
        if (!PROFILES.contains(profile)) {
            throw new IllegalArgumentException("Perfil deve ser gestor, supervisor, residente ou saude.");
        }
        String hash = hashAndClear(password);
        try {
            accounts.create(normalizedEnrollment, normalizedEmail, normalizedName, hash, profile);
        } catch (DuplicateKeyException error) {
            throw new IllegalArgumentException("Já existe uma conta com essa matrícula ou e-mail.", error);
        }
    }

    @Transactional
    public void resetPassword(String email, char[] password) {
        LocalAccount account = requireActiveAccount(email);
        String hash = hashAndClear(password);
        if (accounts.updatePassword(account, hash) != 1) {
            throw new IllegalArgumentException("Conta ativa nao encontrada.");
        }
    }

    @Transactional
    public void disable(String email) {
        if (accounts.disable(requireActiveAccount(email)) != 1) {
            throw new IllegalArgumentException("Conta ativa nao encontrada.");
        }
    }

    @Transactional
    public void linkResident(String email, UUID residentId) { linkResident(requireActiveAccount(email), residentId); }

    @Transactional
    public void linkResident(UUID accountId, UUID residentId) { linkResident(requireActiveAccount(accountId), residentId); }

    private void linkResident(LocalAccount account, UUID residentId) {
        if (!account.profile().equals("residente")) {
            throw new IllegalArgumentException("Perfil da conta deve ser residente para esse vinculo.");
        }
        if (residentId == null || !accounts.residentExists(residentId)) {
            throw new IllegalArgumentException("Residente nao encontrado.");
        }
        changeLink(account, residentId, null);
    }

    @Transactional
    public void linkSupervisor(String email, UUID supervisorId) { linkSupervisor(requireActiveAccount(email), supervisorId); }

    @Transactional
    public void linkSupervisor(UUID accountId, UUID supervisorId) { linkSupervisor(requireActiveAccount(accountId), supervisorId); }

    private void linkSupervisor(LocalAccount account, UUID supervisorId) {
        if (!Set.of("gestor", "supervisor").contains(account.profile())) {
            throw new IllegalArgumentException(
                    "Perfil da conta deve ser gestor ou supervisor para esse vinculo.");
        }
        if (supervisorId == null || !accounts.supervisorExists(supervisorId)) {
            throw new IllegalArgumentException("Supervisor nao encontrado.");
        }
        changeLink(account, null, supervisorId);
    }

    @Transactional
    public void unlink(String email, UUID expectedRecordId) {
        unlink(accounts.findForUpdate(email).orElseThrow(() -> new IllegalArgumentException("Conta nao encontrada.")), expectedRecordId);
    }

    @Transactional
    public void unlink(UUID accountId, UUID expectedRecordId) {
        unlink(accounts.findByIdForUpdate(accountId).orElseThrow(() -> new IllegalArgumentException("Conta nao encontrada.")), expectedRecordId);
    }

    private void unlink(LocalAccount account, UUID expectedRecordId) {
        if (expectedRecordId == null
                || (!expectedRecordId.equals(account.residentId())
                        && !expectedRecordId.equals(account.supervisorId()))) {
            throw new IllegalArgumentException("Vinculo atual nao corresponde ao UUID informado.");
        }
        changeLink(account, null, null);
    }

    @Transactional
    public void resetPassword(UUID accountId, char[] password) {
        if (accounts.updatePassword(requireActiveAccount(accountId), hashAndClear(password)) != 1)
            throw new IllegalArgumentException("Conta ativa nao encontrada.");
    }

    @Transactional
    public void disable(UUID accountId) {
        if (accounts.disable(requireActiveAccount(accountId)) != 1)
            throw new IllegalArgumentException("Conta ativa nao encontrada.");
    }

    private LocalAccount requireActiveAccount(UUID accountId) {
        return accounts.findByIdForUpdate(accountId).filter(LocalAccount::active)
                .orElseThrow(() -> new IllegalArgumentException("Conta ativa nao encontrada."));
    }

    private LocalAccount requireActiveAccount(String email) {
        return accounts.findForUpdate(email).filter(LocalAccount::active)
                .orElseThrow(() -> new IllegalArgumentException("Conta ativa nao encontrada."));
    }

    private void changeLink(LocalAccount account, UUID residentId, UUID supervisorId) {
        if (Objects.equals(account.residentId(), residentId)
                && Objects.equals(account.supervisorId(), supervisorId)) {
            return;
        }
        try {
            accounts.updateLink(account, residentId, supervisorId);
        } catch (DuplicateKeyException error) {
            throw new IllegalArgumentException(
                    "Registro ja vinculado a outra conta. Desvincule essa conta primeiro.", error);
        } catch (DataIntegrityViolationException error) {
            throw new IllegalArgumentException("Vinculo invalido. Confira o registro e o perfil da conta.", error);
        }
    }

    public String hashAndClear(char[] password) {
        try {
            if (password == null || password.length < 12 || password.length > 72) {
                throw new IllegalArgumentException("Senha deve ter entre 12 e 72 caracteres.");
            }
            String value = new String(password);
            if (value.getBytes(StandardCharsets.UTF_8).length > 72) {
                throw new IllegalArgumentException("Senha deve ter no maximo 72 bytes UTF-8.");
            }
            return passwords.encode(value);
        } finally {
            if (password != null) {
                Arrays.fill(password, '\0');
            }
        }
    }

    @Transactional
    public void lockResidentAccount(UUID residentId) { accounts.findByResidentId(residentId); }

    @Transactional
    public void lockSupervisorAccount(UUID id) { accounts.findBySupervisorId(id); }

    @Transactional
    public void synchronizeSupervisorEnrollment(UUID id, String enrollment) {
        accounts.findBySupervisorId(id).ifPresent(account -> {
            if (!Objects.equals(account.enrollment(), enrollment)) assignEnrollment(account.id(), enrollment);
        });
    }

    @Transactional
    public void synchronizeResidentEnrollment(UUID residentId, String enrollment) {
        accounts.findByResidentId(residentId).ifPresent(account -> {
            if (!Objects.equals(account.enrollment(), enrollment)) assignEnrollment(account.id(), enrollment);
        });
    }

    @Transactional
    public void assignEnrollment(UUID accountId, String enrollment) {
        LocalAccount account = accounts.findByIdForUpdate(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Conta não encontrada."));
        try {
            accounts.assignEnrollment(account, normalizeEnrollment(enrollment));
        } catch (DuplicateKeyException error) {
            throw new IllegalArgumentException("Matrícula já utilizada por outra conta.", error);
        }
    }

    public static String normalizeEnrollment(String enrollment) {
        if (enrollment == null || enrollment.isBlank() || enrollment.trim().length() > 64
                || enrollment.contains("@") || enrollment.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("Matrícula deve ter entre 1 e 64 caracteres, sem @ ou controles.");
        }
        return enrollment.trim();
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            throw new IllegalArgumentException("E-mail obrigatorio.");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 320 || !normalized.matches(
                "[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\\.[a-z]{2,}")) {
            throw new IllegalArgumentException("E-mail invalido.");
        }
        return normalized;
    }

    private String requireName(String name) {
        if (name == null || name.isBlank() || name.trim().length() > 200) {
            throw new IllegalArgumentException("Nome deve ter entre 1 e 200 caracteres.");
        }
        return name.trim();
    }
}
