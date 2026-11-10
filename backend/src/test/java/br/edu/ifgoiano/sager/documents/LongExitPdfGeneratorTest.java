package br.edu.ifgoiano.sager.documents;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;

class LongExitPdfGeneratorTest {
    @Test
    void embedsOfflineFontsAndCarriesOnlyTheMinimumDataWithCodeAndRevision() throws Exception {
        var snapshot = snapshot("Consulta e reunião familiar");
        byte[] bytes = new LongExitPdfGenerator(new PdfTextRenderer()).generate(snapshot);

        try (PDDocument document = Loader.loadPDF(bytes)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(LongExitPdfGenerator.TERM_VERSION).hasSizeLessThanOrEqualTo(32);
            assertThat(text).contains("Autorização de saída longa", "João Conceição",
                    "30/09/2026 09:00", "30/09/2026 18:00", "Consulta e reunião familiar",
                    "Maria Conceição", "Assinatura:", "Data:",
                    LongExitPdfGenerator.shortCode(snapshot.documentVersionId()), "Revisão 3",
                    LongExitPdfGenerator.TERM_VERSION, "Página 1 de 1");
            assertThat(text).doesNotContain("202600123", "17/03/2010", "Quarto", "Alojamento",
                    "Matrícula", "Nascimento", snapshot.exitId().toString());
            assertThat(text.toLowerCase(java.util.Locale.ROOT))
                    .doesNotContain("assinatura válida", "assinatura eletrônica", "validade jurídica");
            assertThat(document.getNumberOfPages()).isEqualTo(1);
            for (var page : document.getPages()) {
                for (var name : page.getResources().getFontNames()) {
                    var font = page.getResources().getFont(name);
                    assertThat(font.isEmbedded()).isTrue();
                    assertThat(font.getName()).contains("SourceSans3");
                    assertThat(font.getFontDescriptor().getFontFile2()).isNotNull();
                }
            }
        }
        saveReviewSample("long-exit-one-page.pdf", bytes);
    }

    @Test
    void paginatesLongAccentedParagraphsAndSplitsUnbrokenTextByActualGlyphWidth() throws Exception {
        String repeated = "Participação em reunião familiar, informações e retorno acompanhado. ".repeat(350);
        String unbroken = "ÁÉÍÓÚçãõ".repeat(140);
        var snapshot = snapshot(repeated + "\n" + unbroken + "\nFim das observações.");
        byte[] bytes = new LongExitPdfGenerator(new PdfTextRenderer()).generate(snapshot);

        try (PDDocument document = Loader.loadPDF(bytes)) {
            assertThat(document.getNumberOfPages()).isGreaterThan(3);
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("Fim das observações.", "Página 1 de " + document.getNumberOfPages(),
                    "Página " + document.getNumberOfPages() + " de " + document.getNumberOfPages());
            assertThat(text.replaceAll("\\s", "")).contains(unbroken);
            new BoundsCheckingStripper().getText(document);
        }
        saveReviewSample("long-exit-multiple-pages.pdf", bytes);
    }

    @Test
    void reusableRendererPreservesParagraphBreaksAndAvoidsAnOrphanHeading() throws Exception {
        var content = new PdfTextRenderer.Document("Documento reutilizável", "Identificador sintético",
                List.of(new PdfTextRenderer.Section("Seção inicial", List.of("Primeiro parágrafo.\nSegunda linha.")),
                        new PdfTextRenderer.Section("Seção extensa", List.of("Conteúdo com ação e ç. ".repeat(400)))));
        try (PDDocument document = Loader.loadPDF(new PdfTextRenderer().render(content))) {
            assertThat(new PDFTextStripper().getText(document))
                    .contains("Documento reutilizável", "Primeiro parágrafo.", "Segunda linha.", "Seção extensa");
            new BoundsCheckingStripper().getText(document);
        }
    }

    private static LongExitPdfGenerator.Snapshot snapshot(String reason) {
        return new LongExitPdfGenerator.Snapshot(UUID.randomUUID(), UUID.randomUUID(), 3,
                "João Conceição", Instant.parse("2026-09-30T12:00:00Z"),
                Instant.parse("2026-09-30T21:00:00Z"), reason, "Maria Conceição");
    }

    @Test
    void oldSnapshotsWithRemovedFieldsStillDeserialize() throws Exception {
        var mapper = new tools.jackson.databind.ObjectMapper();
        var old = mapper.readValue(
                "{\"revisionNumber\":1,\"residentName\":\"João\",\"birthDate\":\"2010-03-17\",\"roomNumber\":\"12\"}",
                LongExitPdfGenerator.Snapshot.class);
        assertThat(old.residentName()).isEqualTo("João");
    }

    private static void saveReviewSample(String name, byte[] bytes) throws IOException {
        String configured = System.getProperty("sager.documents.review-dir");
        if (configured != null) {
            Path directory = Path.of(configured);
            Files.createDirectories(directory);
            Files.write(directory.resolve(name), bytes);
        }
    }

    private static final class BoundsCheckingStripper extends PDFTextStripper {
        private BoundsCheckingStripper() throws IOException {
            super();
        }

        @Override
        protected void writeString(String text, List<TextPosition> positions) throws IOException {
            for (TextPosition position : positions) {
                assertThat(position.getXDirAdj()).isGreaterThanOrEqualTo(40);
                assertThat(position.getXDirAdj() + position.getWidthDirAdj()).isLessThanOrEqualTo(556);
                assertThat(position.getYDirAdj()).isBetween(35f, 807f);
            }
            super.writeString(text, positions);
        }
    }
}
