package br.edu.ifgoiano.sager.health;

import org.springframework.http.HttpStatus;

public class HealthApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public HealthApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }

    public String code() { return code; }
}
