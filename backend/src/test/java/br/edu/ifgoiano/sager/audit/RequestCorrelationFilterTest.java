package br.edu.ifgoiano.sager.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestCorrelationFilterTest {
    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void generatedIdentifierIsSharedByRequestResponseAndLogsInsteadOfTrustingCallerHeader()
            throws Exception {
        var request = new MockHttpServletRequest();
        UUID supplied = UUID.randomUUID();
        request.addHeader("X-Request-Id", supplied.toString());
        var response = new MockHttpServletResponse();
        new RequestCorrelationFilter().doFilter(request, response, (incoming, outgoing) -> {
            UUID requestId = (UUID) incoming.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE);
            assertThat(requestId).isNotNull().isNotEqualTo(supplied);
            assertThat(response.getHeader("X-Request-Id")).isEqualTo(requestId.toString());
            assertThat(MDC.get("requestId")).isEqualTo(requestId.toString());
        });
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void failureRestoresPreviousLoggingContextRatherThanLeakingRequestIdentity() {
        MDC.put("requestId", "previous-context");
        assertThatThrownBy(() -> new RequestCorrelationFilter().doFilter(
                new MockHttpServletRequest(), new MockHttpServletResponse(), (request, response) -> {
                    assertThat(MDC.get("requestId")).isNotEqualTo("previous-context");
                    throw new ServletException("synthetic failure");
                })).isInstanceOf(ServletException.class);
        assertThat(MDC.get("requestId")).isEqualTo("previous-context");
    }
}
