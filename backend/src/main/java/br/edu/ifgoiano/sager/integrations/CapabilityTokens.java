package br.edu.ifgoiano.sager.integrations;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

public final class CapabilityTokens {
    private static final SecureRandom RANDOM = new SecureRandom();

    private CapabilityTokens() {}

    public static String issue() {
        byte[] value = new byte[32];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    public static String hash(String value) {
        return hash(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public static String hash(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 indisponível.");
        }
    }
}
