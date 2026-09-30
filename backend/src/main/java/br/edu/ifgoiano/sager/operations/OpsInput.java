package br.edu.ifgoiano.sager.operations;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;

public final class OpsInput {
    private OpsInput() {
    }

    public static void object(JsonNode body, String... fields) {
        if (body == null || !body.isObject()) throw invalid("Informe um objeto JSON.");
        Set<String> allowed = Set.of(fields);
        for (var property : body.properties()) {
            if (!allowed.contains(property.getKey())) throw invalid("O corpo contém campo não permitido.");
        }
    }

    public static String text(JsonNode body, String field, boolean required, int minimum, int maximum) {
        JsonNode value = body.get(field);
        if (value == null || value.isNull()) {
            if (required) throw invalid(field + " é obrigatório.");
            return null;
        }
        if (!value.isString()) throw invalid(field + " deve ser texto JSON.");
        String normalized = value.stringValue().trim();
        if (normalized.isEmpty() && !required) return null;
        if (characters(normalized) < minimum || characters(normalized) > maximum) {
            throw invalid(field + " possui comprimento inválido.");
        }
        return normalized;
    }

    public static int characters(String value) {
        return value.codePointCount(0, value.length());
    }

    public static UUID uuid(JsonNode body, String field) {
        String value = text(body, field, true, 36, 36);
        try {
            UUID id = UUID.fromString(value);
            if (!id.toString().equalsIgnoreCase(value)) throw invalid(field + " deve ser UUID válido.");
            return id;
        } catch (IllegalArgumentException error) {
            throw invalid(field + " deve ser UUID válido.");
        }
    }

    public static long version(JsonNode body) {
        JsonNode value = body.get("version");
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE) {
            throw invalid("version deve ser inteiro não negativo válido.");
        }
        return value.asLong();
    }

    public static boolean bool(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null) return false;
        if (!value.isBoolean()) throw invalid(field + " deve ser booleano.");
        return value.booleanValue();
    }

    public static Instant instant(JsonNode body, String field, boolean required) {
        String value = text(body, field, required, 1, 64);
        if (value == null) return null;
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException error) {
            throw invalid(field + " deve conter data e hora com fuso explícito.");
        }
    }

    public static OpsApiException invalid(String message) {
        return new OpsApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    public static OpsApiException conflict(String code, String message) {
        return new OpsApiException(HttpStatus.CONFLICT, code, message);
    }

    public static OpsApiException notFound() {
        return new OpsApiException(HttpStatus.NOT_FOUND, "not_found", "Registro não encontrado.");
    }
}
