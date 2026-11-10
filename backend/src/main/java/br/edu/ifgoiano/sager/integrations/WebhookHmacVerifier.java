package br.edu.ifgoiano.sager.integrations;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class WebhookHmacVerifier {
    private static final String ALGORITHM = "HmacSHA512";

    private WebhookHmacVerifier() {}

    /** Compares the X-Webhook-Hmac hex digest over the raw bytes in constant time. */
    public static boolean valid(String header, String secret, byte[] body) {
        if (header == null
                || !header.matches("[0-9a-fA-F]{128}")
                || secret == null
                || secret.isBlank()
                || body == null) return false;
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            return MessageDigest.isEqual(mac.doFinal(body), HexFormat.of().parseHex(header));
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("HMAC indisponível.");
        }
    }
}
