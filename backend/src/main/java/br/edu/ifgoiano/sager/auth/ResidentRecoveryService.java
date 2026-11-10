package br.edu.ifgoiano.sager.auth;

import br.edu.ifgoiano.sager.management.FieldRules;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile({"local", "production"})
public class ResidentRecoveryService {
    private final LocalAccountRepository accounts;
    private final LocalAccountProvisioningService provisioning;
    private final JdbcTemplate jdbc;
    public ResidentRecoveryService(LocalAccountRepository accounts, LocalAccountProvisioningService provisioning, JdbcTemplate jdbc) {
        this.accounts = accounts; this.provisioning = provisioning; this.jdbc = jdbc;
    }
    @Transactional
    public void recover(String enrollment, String name, LocalDate birthDate, String guardianName, String password, String confirmation) {
        if (password == null || !password.equals(confirmation)) throw refused();
        if (enrollment != null && password.equalsIgnoreCase(FieldRules.normalizeEnrollment(enrollment))) throw refused();
        String hash;
        // Antes da busca e com a matrícula informada: a recusa não pode depender de a conta existir.
        try { hash = provisioning.hashAndClear(password.toCharArray(), enrollment); }
        catch (IllegalArgumentException error) { throw refused(); }
        LocalAccount account = accounts.findForLogin(enrollment == null ? "" : enrollment.trim()).orElse(null);
        if (account == null || !account.active() || !account.profile().equals("residente") || account.residentId() == null) throw refused();
        String found = account.enrollment();
        account = accounts.findByIdForUpdate(account.id()).orElseThrow(ResidentRecoveryService::refused);
        if (!account.active() || account.residentId() == null || !account.profile().equals("residente") || !found.equals(account.enrollment())) throw refused();
        var residents = jdbc.query("SELECT name,birth_date FROM sager_resident WHERE id=? FOR SHARE",
                (r,n) -> new Identity(r.getString("name"), r.getObject("birth_date", LocalDate.class)), account.residentId());
        if (residents.isEmpty() || birthDate == null || !Objects.equals(residents.getFirst().birthDate(), birthDate)
                || normalize(name).isEmpty() || !normalize(name).equals(normalize(residents.getFirst().name()))) throw refused();
        var guardians = jdbc.query("SELECT name FROM sager_guardian WHERE resident_id=? AND active=true FOR SHARE",
                (r,n) -> r.getString("name"), account.residentId());
        if (!guardians.isEmpty() && guardians.stream().noneMatch(value -> !normalize(guardianName).isEmpty() && normalize(value).equals(normalize(guardianName)))) throw refused();
        if (accounts.updatePassword(account, hash) != 1) throw refused();
    }
    static String normalize(String value) {
        return value == null ? "" : Normalizer.normalize(value.strip(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
    private record Identity(String name, LocalDate birthDate) {}
    private static ResponseStatusException refused() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não foi possível redefinir. Confira os dados e os requisitos da senha ou procure a equipe responsável.");
    }
}
