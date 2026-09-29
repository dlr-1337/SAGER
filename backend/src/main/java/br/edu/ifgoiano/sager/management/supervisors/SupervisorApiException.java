package br.edu.ifgoiano.sager.management.supervisors;

import org.springframework.http.HttpStatus;

public class SupervisorApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public SupervisorApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
