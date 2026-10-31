package br.edu.ifgoiano.sager.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;

import java.util.function.Supplier;

/**
 * Looking for the token in the parameters makes the container parse a multipart body, writing it
 * to disk before anyone is authenticated. The frontend always sends the token in the header.
 */
final class HeaderOnlyCsrfTokenHandler implements CsrfTokenRequestHandler {
    private final XorCsrfTokenRequestAttributeHandler delegate =
            new XorCsrfTokenRequestAttributeHandler();

    @Override
    public void handle(
            HttpServletRequest request, HttpServletResponse response, Supplier<CsrfToken> token) {
        delegate.handle(request, response, token);
    }

    @Override
    public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken token) {
        return delegate.resolveCsrfTokenValue(
                new HttpServletRequestWrapper(request) {
                    @Override
                    public String getParameter(String name) {
                        return null;
                    }
                },
                token);
    }
}
