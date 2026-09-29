package br.edu.ifgoiano.sager.management.rooms;

import org.springframework.http.HttpStatus;

public class RoomApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public RoomApiException(HttpStatus status, String code, String message) {
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
