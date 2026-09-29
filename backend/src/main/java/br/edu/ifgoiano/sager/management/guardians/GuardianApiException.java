package br.edu.ifgoiano.sager.management.guardians;

import org.springframework.http.HttpStatus;

public class GuardianApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public GuardianApiException(HttpStatus status, String code, String message) {
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
