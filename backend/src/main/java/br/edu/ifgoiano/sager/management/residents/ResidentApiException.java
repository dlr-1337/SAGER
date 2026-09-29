package br.edu.ifgoiano.sager.management.residents;

import org.springframework.http.HttpStatus;

public class ResidentApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ResidentApiException(HttpStatus status, String code, String message) {
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
