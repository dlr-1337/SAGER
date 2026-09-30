package br.edu.ifgoiano.sager.discipline;

import org.springframework.http.HttpStatus;

public class DisciplineApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    public DisciplineApiException(HttpStatus status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public HttpStatus status() { return status; }
    public String code() { return code; }
}
