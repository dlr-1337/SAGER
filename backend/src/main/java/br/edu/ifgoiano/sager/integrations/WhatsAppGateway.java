package br.edu.ifgoiano.sager.integrations;

import java.time.Instant;
import java.util.List;

/** The domain sees only this contract; every default answers as a disabled gateway. */
public interface WhatsAppGateway {
    default boolean available() {
        return false;
    }

    default SessionState session() {
        throw disabled();
    }

    default void startSession() {
        throw disabled();
    }

    default byte[] qr() {
        throw disabled();
    }

    /** Returns the chat that really exists for the digits, resolving the ninth-digit variation. */
    default String resolveRecipient(String phoneDigits) {
        throw disabled();
    }

    /** Returns the canonical phone, or null when the gateway does not know this LID. */
    default String resolveLid(String lid) {
        throw disabled();
    }

    /** Every send returns the short message identifier used by delivery events and replies. */
    default String sendDocument(String chatId, String filename, byte[] bytes, String caption) {
        throw disabled();
    }

    default String sendText(String chatId, String text) {
        throw disabled();
    }

    default String sendImage(
            String chatId, String filename, String mimeType, byte[] bytes, String caption) {
        throw disabled();
    }

    default String sendVoice(String chatId, String mimeType, byte[] bytes) {
        throw disabled();
    }

    /** Accepts only a path inside the gateway file area; the host always comes from configuration. */
    default byte[] downloadMedia(String path) {
        throw disabled();
    }

    default List<InboundMessage> recentMessages(String chatId, Instant since) {
        throw disabled();
    }

    private static ProviderFailure disabled() {
        return new ProviderFailure(ProviderFailure.Kind.DISABLED, "provider_disabled");
    }

    record SessionState(String status) {}

    record InboundMessage(
            String session,
            String messageId,
            String chatId,
            String senderPhone,
            String senderLid,
            String body,
            boolean hasMedia,
            String mediaPath,
            String mediaMimeType,
            String mediaFilename,
            String mediaFailure,
            String quotedMessageId,
            Instant sentAt,
            boolean fromMe) {}
}
