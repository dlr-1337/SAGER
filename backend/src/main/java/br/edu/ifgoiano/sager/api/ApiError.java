package br.edu.ifgoiano.sager.api;

import java.util.UUID;

/** Public error contract. It never includes exception details or submitted values. */
public record ApiError(String code, String message, UUID requestId) {
}
