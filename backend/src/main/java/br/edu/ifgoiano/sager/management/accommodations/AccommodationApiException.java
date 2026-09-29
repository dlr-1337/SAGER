package br.edu.ifgoiano.sager.management.accommodations;

import org.springframework.http.HttpStatus;

public class AccommodationApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public AccommodationApiException(HttpStatus status, String code, String message) {
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
