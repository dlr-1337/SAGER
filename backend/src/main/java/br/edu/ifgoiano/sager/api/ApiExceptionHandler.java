package br.edu.ifgoiano.sager.api;

import br.edu.ifgoiano.sager.documents.PrivateFileException;
import br.edu.ifgoiano.sager.documents.PdfGenerationException;
import br.edu.ifgoiano.sager.health.HealthApiException;
import br.edu.ifgoiano.sager.discipline.DisciplineApiException;
import br.edu.ifgoiano.sager.management.accommodations.AccommodationApiException;
import br.edu.ifgoiano.sager.management.allocations.AllocationApiException;
import br.edu.ifgoiano.sager.management.guardians.GuardianApiException;
import br.edu.ifgoiano.sager.management.residents.ResidentApiException;
import br.edu.ifgoiano.sager.management.rooms.RoomApiException;
import br.edu.ifgoiano.sager.management.supervisors.SupervisorApiException;
import br.edu.ifgoiano.sager.operations.OpsApiException;
import br.edu.ifgoiano.sager.reports.ReportingApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler({ SupervisorApiException.class, ResidentApiException.class,
            GuardianApiException.class, AccommodationApiException.class,
            RoomApiException.class, AllocationApiException.class, OpsApiException.class,
            HealthApiException.class, DisciplineApiException.class, ReportingApiException.class })
    public ResponseEntity<ApiError> domainError(RuntimeException error, HttpServletRequest request) {
        DomainError details = switch (error) {
            case SupervisorApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case ResidentApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case GuardianApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case AccommodationApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case RoomApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case AllocationApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case OpsApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case HealthApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case DisciplineApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            case ReportingApiException e -> new DomainError(e.status(), e.code(), e.getMessage());
            default -> throw new IllegalArgumentException("Tipo de erro de domínio não suportado.");
        };
        return ApiErrors.response(request, details.status(), details.code(), details.message());
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class })
    public ResponseEntity<ApiError> invalidInput(Exception error, HttpServletRequest request) {
        return ApiErrors.response(request, HttpStatus.BAD_REQUEST, "invalid_input",
                ApiErrors.message(400));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> responseStatus(ResponseStatusException error, HttpServletRequest request) {
        int status = error.getStatusCode().value();
        return ApiErrors.response(request, error.getStatusCode(), ApiErrors.code(status), ApiErrors.message(status));
    }

    @ExceptionHandler({ NoResourceFoundException.class, NoHandlerFoundException.class })
    public ResponseEntity<ApiError> notFound(Exception error, HttpServletRequest request) {
        return ApiErrors.response(request, HttpStatus.NOT_FOUND, "not_found", ApiErrors.message(404));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> methodNotAllowed(Exception error, HttpServletRequest request) {
        return ApiErrors.response(request, HttpStatus.METHOD_NOT_ALLOWED,
                "method_not_allowed", ApiErrors.message(405));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> unsupportedMedia(Exception error, HttpServletRequest request) {
        return ApiErrors.response(request, HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "unsupported_media_type", ApiErrors.message(415));
    }

    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<ApiError> unacceptableMedia(Exception error, HttpServletRequest request) {
        return ApiErrors.response(request, HttpStatus.NOT_ACCEPTABLE, "not_acceptable", ApiErrors.message(406));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> forbidden(Exception error, HttpServletRequest request) {
        return ApiErrors.response(request, HttpStatus.FORBIDDEN, "forbidden", ApiErrors.message(403));
    }

    @ExceptionHandler({ PrivateFileException.class, PdfGenerationException.class })
    public ResponseEntity<ApiError> documentUnavailable(RuntimeException error, HttpServletRequest request) {
        return ApiErrors.response(request, HttpStatus.SERVICE_UNAVAILABLE, "document_unavailable",
                "O documento está temporariamente indisponível. Tente novamente mais tarde.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception error, HttpServletRequest request) {
        // Exception messages, SQL details and stack frames can contain personal input.
        LOG.error("api_failure requestId={} exceptionType={}", ApiErrors.requestId(request),
                error.getClass().getSimpleName());
        return ApiErrors.response(request, HttpStatus.INTERNAL_SERVER_ERROR,
                "internal_error", ApiErrors.message(500));
    }

    private record DomainError(HttpStatus status, String code, String message) {
    }
}
