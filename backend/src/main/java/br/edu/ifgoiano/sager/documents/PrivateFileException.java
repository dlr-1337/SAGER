package br.edu.ifgoiano.sager.documents;

/** A sanitized, fail-closed private-file operation failure. */
public final class PrivateFileException extends RuntimeException {
    public PrivateFileException(String message) {
        super(message);
    }
}
