package br.edu.ifgoiano.sager.documents;

/** Rendering fails closed without exposing snapshot contents or filesystem details. */
public final class PdfGenerationException extends RuntimeException {
    public PdfGenerationException() {
        super("Não foi possível gerar o documento PDF.");
    }
}
