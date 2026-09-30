package br.edu.ifgoiano.sager.api;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Handles servlet/filter errors without exposing Boot's exception attributes. */
@RestController
public class ApiErrorController implements ErrorController {
    @RequestMapping("/error")
    public ResponseEntity<ApiError> error(HttpServletRequest request) {
        Object attribute = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        HttpStatus status = attribute instanceof Integer code ? HttpStatus.resolve(code) : null;
        if (status == null || !status.isError()) status = HttpStatus.INTERNAL_SERVER_ERROR;
        return ApiErrors.response(request, status, ApiErrors.code(status.value()), ApiErrors.message(status.value()));
    }
}
