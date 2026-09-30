package br.edu.ifgoiano.sager.documents;

import java.util.UUID;

/** Persistable metadata; physical storage paths are deliberately absent. */
public record StoredFile(UUID id, String sha256, long size, String state) {
    public static final String STORED = "STORED";
}
