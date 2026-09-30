package br.edu.ifgoiano.sager.operations.longexits;

import org.springframework.http.HttpStatus;

public final class LongExitApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public LongExitApiException(HttpStatus status, String code, String message) {
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
