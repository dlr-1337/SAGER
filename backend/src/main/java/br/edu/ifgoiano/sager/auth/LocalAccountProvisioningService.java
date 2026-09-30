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
@Profile("local")
public class LocalAccountProvisioningService {
    private static final Set<String> PROFILES = Set.of("gestor", "supervisor", "residente", "saude");

    private final LocalAccountRepository accounts;
    private final PasswordEncoder passwords;

    public LocalAccountProvisioningService(LocalAccountRepository accounts, PasswordEncoder passwords) {
        this.accounts = accounts;
        this.passwords = passwords;
    }

    @Transactional
    public void create(String email, String name, String profile, char[] password) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedName = requireName(name);
        if (!PROFILES.contains(profile)) {
            throw new IllegalArgumentException("Perfil deve ser gestor, supervisor, residente ou saude.");
        }
        String hash = hashAndClear(password);
        try {
            accounts.create(normalizedEmail, normalizedName, hash, profile);
        } catch (DuplicateKeyException error) {
            throw new IllegalArgumentException("Ja existe uma conta com esse e-mail.", error);
        }
    }

    @Transactional
    public void resetPassword(String email, char[] password) {
        String normalizedEmail = normalizeEmail(email);
        String hash = hashAndClear(password);
        if (accounts.updatePassword(normalizedEmail, hash) != 1) {
            throw new IllegalArgumentException("Conta ativa nao encontrada.");
        }
    }

    @Transactional
    public void disable(String email) {
        if (accounts.disable(normalizeEmail(email)) != 1) {
            throw new IllegalArgumentException("Conta ativa nao encontrada.");
        }
    }

    @Transactional
    public void linkResident(String email, UUID residentId) {
        LocalAccount account = requireActiveAccount(email);
        if (!account.profile().equals("residente")) {
            throw new IllegalArgumentException("Perfil da conta deve ser residente para esse vinculo.");
        }
        if (residentId == null || !accounts.residentExists(residentId)) {
            throw new IllegalArgumentException("Residente nao encontrado.");
        }
        changeLink(account, residentId, null);
    }

    @Transactional
    public void linkSupervisor(String email, UUID supervisorId) {
        LocalAccount account = requireActiveAccount(email);
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
        // Removing a disabled account's link releases the unique domain record;
        // it does not reactivate the account or grant any access.
        LocalAccount account = accounts.findByEmailForUpdate(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Conta nao encontrada."));
        if (expectedRecordId == null
                || (!expectedRecordId.equals(account.residentId())
                        && !expectedRecordId.equals(account.supervisorId()))) {
            throw new IllegalArgumentException("Vinculo atual nao corresponde ao UUID informado.");
        }
        changeLink(account, null, null);
    }

    private LocalAccount requireActiveAccount(String email) {
        return accounts.findByEmailForUpdate(normalizeEmail(email)).filter(LocalAccount::active)
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

    private String hashAndClear(char[] password) {
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
