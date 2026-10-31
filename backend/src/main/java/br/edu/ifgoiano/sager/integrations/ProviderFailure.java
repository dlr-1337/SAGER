package br.edu.ifgoiano.sager.integrations;

public final class ProviderFailure extends RuntimeException {
    public enum Kind {
        RETRYABLE,
        PERMANENT,
        UNCERTAIN,
        DISABLED
    }

    private final Kind kind;
    private final String code;
    private final int httpStatus;

    public ProviderFailure(Kind kind, String code) {
        this(kind, code, 0);
    }

    ProviderFailure(Kind kind, String code, int httpStatus) {
        super("Integração externa indisponível.");
        this.kind = kind;
        this.code = code;
        this.httpStatus = httpStatus;
    }

    int httpStatus() {
        return httpStatus;
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }
}
