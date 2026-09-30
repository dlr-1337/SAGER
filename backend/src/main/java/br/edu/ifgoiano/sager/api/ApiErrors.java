package br.edu.ifgoiano.sager.api;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import br.edu.ifgoiano.sager.audit.AuditContextProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ApiErrors {
    private final ObjectMapper json;

    public ApiErrors(ObjectMapper json) {
        this.json = json;
    }

    public static UUID requestId(HttpServletRequest request) {
        Object current = request.getAttribute(AuditContextProvider.REQUEST_ID_ATTRIBUTE);
        if (current instanceof UUID id) return id;
        UUID generated = UUID.randomUUID();
        request.setAttribute(AuditContextProvider.REQUEST_ID_ATTRIBUTE, generated);
        return generated;
    }

    public static ResponseEntity<ApiError> response(HttpServletRequest request, HttpStatusCode status,
            String code, String message) {
        UUID id = requestId(request);
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .header("X-Request-Id", id.toString()).body(new ApiError(code, message, id));
    }

    public void write(HttpServletRequest request, HttpServletResponse response, int status,
            String code, String message) throws IOException {
        UUID id = requestId(request);
        response.setStatus(status);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Request-Id", id.toString());
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        json.writeValue(response.getOutputStream(), new ApiError(code, message, id));
    }

    public static String code(int status) {
        return switch (status) {
            case 400 -> "invalid_input";
            case 401 -> "unauthorized";
            case 403 -> "forbidden";
            case 404 -> "not_found";
            case 405 -> "method_not_allowed";
            case 406 -> "not_acceptable";
            case 415 -> "unsupported_media_type";
            default -> "internal_error";
        };
    }

    public static String message(int status) {
        return switch (status) {
            case 400 -> "Solicitação inválida. Confira os campos e tente novamente.";
            case 401 -> "A sessão não está disponível. Entre novamente.";
            case 403 -> "Sua conta não tem acesso a esta ação.";
            case 404 -> "Registro ou recurso não encontrado.";
            case 405 -> "Método não disponível para este recurso.";
            case 406 -> "Formato de resposta não disponível.";
            case 415 -> "Formato de envio não disponível. Use JSON.";
            default -> "Não foi possível concluir a operação. Informe a referência da requisição ao suporte.";
        };
    }
}
