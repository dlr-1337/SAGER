package br.edu.ifgoiano.sager.auth;

import java.util.List;
import java.util.Locale;

import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile({ "local", "production" })
public class LocalAccountAuthenticationProvider implements AuthenticationProvider {
    private final LocalAccountRepository accounts;
    private final PasswordEncoder passwords;
    private final String dummyPasswordHash;

    public LocalAccountAuthenticationProvider(LocalAccountRepository accounts, PasswordEncoder passwords) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.dummyPasswordHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        String enrollment = authentication.getName().trim();
        String password = String.valueOf(authentication.getCredentials());
        LocalAccount account = accounts.findByEnrollment(enrollment).orElse(null);
        boolean valid = passwords.matches(password, account == null ? dummyPasswordHash : account.passwordHash());
        if (account == null || enrollment.contains("@") || !account.active() || !valid) {
            throw new BadCredentialsException("Credenciais invalidas");
        }
        LocalAccountPrincipal principal = new LocalAccountPrincipal(account.id(), account.email(),
                account.name(), account.profile(), account.residentId(), account.supervisorId(), account.enrollment());
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + account.profile().toUpperCase(Locale.ROOT))));
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
