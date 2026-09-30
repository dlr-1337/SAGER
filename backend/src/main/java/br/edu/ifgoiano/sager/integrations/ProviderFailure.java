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

    public ProviderFailure(Kind kind, String code) {
        super("Integração externa indisponível.");
        this.kind = kind;
        this.code = code;
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }
}
