package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpServletRequestWrapper;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.web.csrf.DefaultCsrfToken;

class HeaderOnlyCsrfTokenHandlerTest {
    private final DefaultCsrfToken token = new DefaultCsrfToken("X-CSRF-TOKEN", "_csrf", "segredo");

    @Test
    void neverTouchesTheParametersSoAMultipartBodyStaysUnparsed() {
        MockHttpServletRequest raw = new MockHttpServletRequest("POST", "/api/v1/conversas");
        raw.setParameter("_csrf", "segredo");
        var request =
                new HttpServletRequestWrapper(raw) {
                    @Override
                    public String getParameter(String name) {
                        throw new AssertionError("O corpo não pode ser lido antes da autenticação.");
                    }
                };
        assertThat(new HeaderOnlyCsrfTokenHandler().resolveCsrfTokenValue(request, token)).isNull();
    }
}
