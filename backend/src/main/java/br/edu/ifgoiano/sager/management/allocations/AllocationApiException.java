package br.edu.ifgoiano.sager.management.allocations;

import org.springframework.http.HttpStatus;

public class AllocationApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public AllocationApiException(HttpStatus status, String code, String message) {
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
