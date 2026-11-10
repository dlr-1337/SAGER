package br.edu.ifgoiano.sager.integrations;

import static br.edu.ifgoiano.sager.integrations.AuthorizationFileType.starts;

import java.util.Locale;
import java.util.Map;

/** Allowed conversation files. The type comes from the bytes, as for authorizations. */
public final class ConversationFileType {
    private static final Map<String, String> AUDIO =
            Map.of(
                    "audio/ogg", "ogg",
                    "audio/mpeg", "mp3",
                    "audio/webm", "webm",
                    "audio/mp4", "m4a");

    private ConversationFileType() {}

    /** A sender chooses the name, never the extension: Windows opens files by their extension. */
    public static String safeName(String original, String type) {
        String clean =
                original == null
                        ? ""
                        : original.substring(
                                        Math.max(
                                                        original.lastIndexOf('/'),
                                                        original.lastIndexOf('\\'))
                                                + 1)
                                .replaceAll("[\\p{Cntrl}\\p{Cf}\"]", "")
                                .trim();
        String base = clean.replaceFirst("\\.[^.]*$", "").replaceAll("[.\\s]+$", "");
        if (base.isEmpty()) base = "arquivo";
        if (base.length() > 200) base = base.substring(0, 200);
        String extension =
                type != null && AuthorizationFileType.accepts(type)
                        ? AuthorizationFileType.extension(type)
                        : type == null ? null : AUDIO.get(type);
        return extension == null ? base : base + "." + extension;
    }

    /** The declared type only tells audio from video inside containers that hold both. */
    public static String detect(byte[] bytes, String declared) {
        String file = AuthorizationFileType.detect(bytes);
        if (file != null) return file;
        if (starts(bytes, 0, "OggS")) return "audio/ogg";
        if (starts(bytes, 0, "ID3")
                || (bytes.length > 2 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xE0) == 0xE0))
            return "audio/mpeg";
        if (declared == null || !declared.toLowerCase(Locale.ROOT).startsWith("audio/")) return null;
        if (bytes.length > 4
                && (bytes[0] & 0xFF) == 0x1A
                && (bytes[1] & 0xFF) == 0x45
                && (bytes[2] & 0xFF) == 0xDF
                && (bytes[3] & 0xFF) == 0xA3) return "audio/webm";
        return starts(bytes, 4, "ftyp") ? "audio/mp4" : null;
    }
}
