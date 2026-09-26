package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

class InstitutionalOidcUserServiceTest {
    private IdentityRepository identities;
    private OAuth2UserService<OidcUserRequest, OidcUser> delegate;
    private OidcUserRequest request;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        identities = mock(IdentityRepository.class);
        delegate = mock(OAuth2UserService.class);
        request = mock(OidcUserRequest.class);
    }

    @Test
    void grantsOnlyThePreprovisionedLocalProfile() {
        when(delegate.loadUser(any())).thenReturn(user("ifgoiano.edu.br", true,
                "servidor@exemplo.invalid"));
        UUID id = UUID.randomUUID();
        when(identities.findOrCreate("https://accounts.google.com", "subject-1"))
                .thenReturn(new LocalIdentity(id, true, List.of("supervisor")));

        OidcUser result = service("ifgoiano.edu.br").loadUser(request);

        assertThat(result.getAuthorities()).extracting("authority").containsExactly("ROLE_SUPERVISOR");
        assertThat(result.getEmail()).isEqualTo("servidor@exemplo.invalid");
        verify(identities).findOrCreate("https://accounts.google.com", "subject-1");
    }

    @Test
    void keepsAnInstitutionalAccountWithoutLocalProfilePending() {
        when(delegate.loadUser(any())).thenReturn(user("ifgoiano.edu.br", true,
                "servidor@exemplo.invalid"));
        UUID id = UUID.randomUUID();
        when(identities.findOrCreate("https://accounts.google.com", "subject-1"))
                .thenReturn(new LocalIdentity(id, true, List.of()));

        assertThatThrownBy(() -> service("ifgoiano.edu.br").loadUser(request))
                .isInstanceOfSatisfying(PendingProfileException.class,
                        error -> assertThat(error.requestId()).isEqualTo(id));
    }

    @Test
    void rejectsAnUnapprovedHostedDomainBeforeCreatingAnIdentity() {
        when(delegate.loadUser(any())).thenReturn(user("outro.edu.br", true,
                "servidor@exemplo.invalid"));

        assertThatThrownBy(() -> service("ifgoiano.edu.br").loadUser(request))
                .isInstanceOfSatisfying(OAuth2AuthenticationException.class,
                        error -> assertThat(error.getError().getErrorCode())
                                .isEqualTo("hosted_domain_not_allowed"));
        verifyNoInteractions(identities);
    }

    @Test
    void rejectsEveryDomainWhenTheApprovedListIsEmpty() {
        when(delegate.loadUser(any())).thenReturn(user("ifgoiano.edu.br", true,
                "servidor@exemplo.invalid"));

        assertThatThrownBy(() -> service("").loadUser(request))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verifyNoInteractions(identities);
    }

    @Test
    void rejectsUnverifiedEmail() {
        when(delegate.loadUser(any())).thenReturn(user("ifgoiano.edu.br", false,
                "servidor@exemplo.invalid"));

        assertThatThrownBy(() -> service("ifgoiano.edu.br").loadUser(request))
                .isInstanceOfSatisfying(OAuth2AuthenticationException.class,
                        error -> assertThat(error.getError().getErrorCode())
                                .isEqualTo("invalid_identity_claims"));
        verifyNoInteractions(identities);
    }

    @Test
    void doesNotTreatAStringAsVerifiedEmail() {
        Map<String, Object> claims = new HashMap<>(user("ifgoiano.edu.br", true,
                "servidor@exemplo.invalid").getIdToken().getClaims());
        claims.put("email_verified", "true");
        OidcIdToken token = new OidcIdToken("synthetic-token", Instant.now(),
                Instant.now().plusSeconds(3600), claims);
        when(delegate.loadUser(any())).thenReturn(new DefaultOidcUser(
                List.of(new SimpleGrantedAuthority("OIDC_USER")), token, "sub"));

        assertThatThrownBy(() -> service("ifgoiano.edu.br").loadUser(request))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verifyNoInteractions(identities);
    }

    @Test
    void rejectsALocallyDisabledIdentity() {
        when(delegate.loadUser(any())).thenReturn(user("ifgoiano.edu.br", true,
                "servidor@exemplo.invalid"));
        when(identities.findOrCreate("https://accounts.google.com", "subject-1"))
                .thenReturn(new LocalIdentity(UUID.randomUUID(), false, List.of("supervisor")));

        assertThatThrownBy(() -> service("ifgoiano.edu.br").loadUser(request))
                .isInstanceOfSatisfying(OAuth2AuthenticationException.class,
                        error -> assertThat(error.getError().getErrorCode())
                                .isEqualTo("local_identity_disabled"));
    }

    @Test
    void usesIssuerAndSubjectWhenEmailChanges() {
        when(delegate.loadUser(any()))
                .thenReturn(user("ifgoiano.edu.br", true, "antes@exemplo.invalid"))
                .thenReturn(user("ifgoiano.edu.br", true, "depois@exemplo.invalid"));
        when(identities.findOrCreate("https://accounts.google.com", "subject-1"))
                .thenReturn(new LocalIdentity(UUID.randomUUID(), true, List.of("supervisor")));
        InstitutionalOidcUserService service = service("ifgoiano.edu.br");

        service.loadUser(request);
        service.loadUser(request);

        verify(identities, org.mockito.Mockito.times(2))
                .findOrCreate("https://accounts.google.com", "subject-1");
    }

    private InstitutionalOidcUserService service(String hostedDomains) {
        return new InstitutionalOidcUserService(identities, hostedDomains, delegate);
    }

    private OidcUser user(String hostedDomain, boolean emailVerified, String email) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("iss", "https://accounts.google.com");
        claims.put("sub", "subject-1");
        claims.put("aud", "client-id");
        claims.put("email", email);
        claims.put("email_verified", emailVerified);
        if (hostedDomain != null) {
            claims.put("hd", hostedDomain);
        }
        OidcIdToken token = new OidcIdToken("synthetic-token", Instant.now(),
                Instant.now().plusSeconds(3600), claims);
        return new DefaultOidcUser(List.of(new SimpleGrantedAuthority("OIDC_USER")), token, "sub");
    }
}
