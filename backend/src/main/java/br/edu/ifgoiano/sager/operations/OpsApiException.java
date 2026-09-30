package br.edu.ifgoiano.sager.operations;

import org.springframework.http.HttpStatus;

public class OpsApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public OpsApiException(HttpStatus status, String code, String message) {
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
