package br.edu.ifgoiano.sager.integrations;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/** The type comes from the bytes; a sender's declared type or file name is never trusted. */
public final class AuthorizationFileType {
    private static final Map<String, String> EXTENSIONS =
            Map.of(
                    "application/pdf", "pdf",
                    "image/jpeg", "jpg",
                    "image/png", "png",
                    "image/webp", "webp",
                    "image/heic", "heic");

    private AuthorizationFileType() {}

    public static String detect(byte[] bytes) {
        if (starts(bytes, 0, "%PDF-")) return "application/pdf";
        if (bytes.length > 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (bytes.length > 8 && (bytes[0] & 0xFF) == 0x89 && starts(bytes, 1, "PNG\r\n"))
            return "image/png";
        if (starts(bytes, 0, "RIFF") && starts(bytes, 8, "WEBP")) return "image/webp";
        if (starts(bytes, 4, "ftyp")
                && (starts(bytes, 8, "heic") || starts(bytes, 8, "heix") || starts(bytes, 8, "mif1")))
            return "image/heic";
        return null;
    }

    public static boolean accepts(String mediaType) {
        return EXTENSIONS.containsKey(mediaType);
    }

    public static String extension(String mediaType) {
        return mediaType == null ? "pdf" : EXTENSIONS.getOrDefault(mediaType, "bin");
    }

    static boolean starts(byte[] bytes, int offset, String ascii) {
        byte[] expected = ascii.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if (bytes[offset + i] != expected[i]) return false;
        }
        return true;
    }
}
