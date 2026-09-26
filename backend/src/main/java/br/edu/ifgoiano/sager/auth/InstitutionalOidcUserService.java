package br.edu.ifgoiano.sager.auth;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;

public class InstitutionalOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {
    private static final Logger log = LoggerFactory.getLogger(InstitutionalOidcUserService.class);

    private final IdentityRepository identities;
    private final OAuth2UserService<OidcUserRequest, OidcUser> delegate;
    private final Set<String> allowedHostedDomains;

    public InstitutionalOidcUserService(IdentityRepository identities, String allowedHostedDomains) {
        this(identities, allowedHostedDomains, new OidcUserService());
    }

    InstitutionalOidcUserService(IdentityRepository identities, String allowedHostedDomains,
            OAuth2UserService<OidcUserRequest, OidcUser> delegate) {
        this.identities = identities;
        this.delegate = delegate;
        this.allowedHostedDomains = Arrays.stream(allowedHostedDomains.split(","))
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public OidcUser loadUser(OidcUserRequest request) throws OAuth2AuthenticationException {
        OidcUser user = delegate.loadUser(request);
        String issuer = user.getIdToken().getClaimAsString("iss");
        String subject = user.getIdToken().getSubject();
        String hostedDomain = user.getIdToken().getClaimAsString("hd");
        String email = user.getIdToken().getClaimAsString("email");
        Object verified = user.getIdToken().getClaims().get("email_verified");

        if (issuer == null || subject == null || subject.isBlank() || email == null
                || email.isBlank() || !(Boolean.TRUE.equals(verified) || "true".equals(verified))) {
            throw rejected("invalid_identity_claims");
        }

        String normalizedDomain = hostedDomain == null ? "" : hostedDomain.toLowerCase(Locale.ROOT);
        if (!allowedHostedDomains.contains(normalizedDomain)) {
            String safeDomain = normalizedDomain.matches("[a-z0-9.-]{1,253}")
                    ? normalizedDomain : "ausente-ou-invalido";
            log.info("Login institucional recusado; hd observado: {}", safeDomain);
            throw rejected("hosted_domain_not_allowed");
        }

        LocalIdentity identity = identities.findOrCreate(issuer, subject);
        if (!identity.active()) {
            throw rejected("local_identity_disabled");
        }
        if (identity.profiles().isEmpty()) {
            throw new PendingProfileException(identity.id());
        }

        List<SimpleGrantedAuthority> authorities = identity.profiles().stream()
                .map(profile -> new SimpleGrantedAuthority("ROLE_" + profile.toUpperCase(Locale.ROOT)))
                .toList();
        return new DefaultOidcUser(authorities, user.getIdToken(), user.getUserInfo(), "sub");
    }

    private static OAuth2AuthenticationException rejected(String code) {
        return new OAuth2AuthenticationException(new OAuth2Error(code), "Acesso não autorizado");
    }
}
