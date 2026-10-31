package br.edu.ifgoiano.sager.integrations;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

class ConversationFileTypeTest {
    private static byte[] ascii(String value) {
        return value.getBytes(StandardCharsets.ISO_8859_1);
    }

    @Test
    void theNameKeepsWhatTheSenderWroteButTheExtensionComesFromTheDetectedType() {
        assertThat(ConversationFileType.safeName("boleto.hta", "application/pdf")).isEqualTo("boleto.pdf");
        assertThat(ConversationFileType.safeName("relatorio.exe", "image/png")).isEqualTo("relatorio.png");
        assertThat(ConversationFileType.safeName("fatura\u202Efdp.exe", "application/pdf"))
                .isEqualTo("faturafdp.pdf");
        assertThat(ConversationFileType.safeName("..\\..\\a/b.bat", "image/jpeg")).isEqualTo("b.jpg");
        assertThat(ConversationFileType.safeName("audio.mp3", "audio/ogg")).isEqualTo("audio.ogg");
        assertThat(ConversationFileType.safeName(null, "application/pdf")).isEqualTo("arquivo.pdf");
        assertThat(ConversationFileType.safeName(".hta", "application/pdf")).isEqualTo("arquivo.pdf");
        assertThat(ConversationFileType.safeName("x".repeat(300) + ".pdf", "application/pdf"))
                .hasSize(204);
        assertThat(ConversationFileType.safeName("aviso.exe", null)).isEqualTo("aviso");
    }

    @Test
    void theBytesDecideAndTheDeclaredTypeOnlySeparatesAudioFromVideo() {
        assertThat(ConversationFileType.detect(ascii("OggS-audio"), null)).isEqualTo("audio/ogg");
        assertThat(ConversationFileType.detect(ascii("ID3-audio"), "text/html")).isEqualTo("audio/mpeg");
        assertThat(ConversationFileType.detect(new byte[] {(byte) 0xFF, (byte) 0xFB, 0, 0}, null))
                .isEqualTo("audio/mpeg");
        byte[] webm = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 1};
        assertThat(ConversationFileType.detect(webm, "AUDIO/webm;codecs=opus")).isEqualTo("audio/webm");
        assertThat(ConversationFileType.detect(webm, "video/webm")).isNull();
        assertThat(ConversationFileType.detect(webm, null)).isNull();
        byte[] mp4 = ascii("\0\0\0\u0018ftypM4A ");
        assertThat(ConversationFileType.detect(mp4, "audio/mp4")).isEqualTo("audio/mp4");
        assertThat(ConversationFileType.detect(mp4, "video/mp4")).isNull();
        assertThat(ConversationFileType.detect(ascii("%PDF-1.7"), "audio/ogg")).isEqualTo("application/pdf");
        assertThat(ConversationFileType.detect(ascii("<svg onload=alert(1)>"), "audio/ogg")).isNull();
        assertThat(ConversationFileType.detect(ascii("MZ"), "audio/mp4")).isNull();
    }

    @Test
    void anAudioFileIsNeverAnAcceptedAuthorization() {
        assertThat(AuthorizationFileType.accepts("audio/ogg")).isFalse();
        assertThat(AuthorizationFileType.accepts("image/jpeg")).isTrue();
        assertThat(AuthorizationFileType.accepts("application/pdf")).isTrue();
    }
}
