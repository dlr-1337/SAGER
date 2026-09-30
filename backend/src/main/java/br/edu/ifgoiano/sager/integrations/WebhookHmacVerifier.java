package br.edu.ifgoiano.sager.integrations;

public final class WebhookHmacVerifier {
    private WebhookHmacVerifier() {}

    public static boolean valid(String header, String secret, byte[] body) {
        if (header == null
                || !header.matches("sha256=[0-9a-fA-F]{64}")
                || secret == null
                || secret.isBlank()
                || body == null) return false;
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(
                    new javax.crypto.spec.SecretKeySpec(
                            secret.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                            "HmacSHA256"));
            return java.security.MessageDigest.isEqual(
                    mac.doFinal(body), java.util.HexFormat.of().parseHex(header.substring(7)));
        } catch (java.security.GeneralSecurityException | IllegalArgumentException error) {
            return false;
        }
    }
}
