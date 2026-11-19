package br.edu.ifgoiano.sager.documents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
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
            // The table option of the renderer must not turn the existing documents.
            assertThat(document.getPage(0).getMediaBox().getHeight())
                    .isGreaterThan(document.getPage(0).getMediaBox().getWidth());
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

    @Test
    void tableRepeatsTheHeaderOnEveryLandscapePageAndWrapsLongCells() throws Exception {
        String longName = "Nome muito comprido de residente sintético ".repeat(6).trim();
        List<List<String>> rows = new ArrayList<>();
        for (int index = 1; index <= 300; index++) {
            rows.add(List.of(String.format("%02d/09/2026", 30 - index % 30), "Registro " + index,
                    index == 150 ? longName : "Pessoa Sintética", "A-102", "Retorno confirmado com atraso"));
        }
        var content = new PdfTextRenderer.Document("Relatório sintético", "Período: 01/09/2026 a 30/09/2026",
                List.of(new PdfTextRenderer.Section("Resumo", List.of("Total de registros: 300")),
                        new PdfTextRenderer.Section("Registros", List.of(), new PdfTextRenderer.Table(
                                List.of("Data", "Registro", "Residente", "Quarto", "Situação"), rows)),
                        new PdfTextRenderer.Section("Conferência", List.of("Código final sintético"))),
                true);
        byte[] bytes = new PdfTextRenderer().render(content);
        try (PDDocument document = Loader.loadPDF(bytes)) {
            int pages = document.getNumberOfPages();
            assertThat(pages).isGreaterThan(3);
            for (int page = 1; page <= pages; page++) {
                var box = document.getPage(page - 1).getMediaBox();
                assertThat(box.getWidth()).isGreaterThan(box.getHeight());
                var stripper = new PDFTextStripper();
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String text = stripper.getText(document);
                if (text.contains("Registro ")) {
                    assertThat(text).contains("Quarto", "Situação");
                }
            }
            String all = new PDFTextStripper().getText(document);
            assertThat(all).contains("Registro 1", "Registro 300", "Página " + pages + " de " + pages);
            assertThat(all.indexOf("Código final sintético")).isGreaterThan(all.indexOf("Registro 300"));
            assertThat(all.replaceAll("\\s", "")).contains(longName.replaceAll("\\s", ""));
            new BoundsCheckingStripper(802, 560).getText(document);
        }
        saveReviewSample("report-table-landscape.pdf", bytes);
    }

    @Test
    void tableRowsMustMatchTheHeader() {
        var content = new PdfTextRenderer.Document("Relatório sintético", null,
                List.of(new PdfTextRenderer.Section("Registros", List.of(),
                        new PdfTextRenderer.Table(List.of("Data", "Situação"), List.of(List.of("01/09/2026"))))),
                true);
        assertThatThrownBy(() -> new PdfTextRenderer().render(content)).isInstanceOf(PdfGenerationException.class);
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
        private final float right;
        private final float bottom;

        private BoundsCheckingStripper() throws IOException {
            this(556, 807);
        }

        private BoundsCheckingStripper(float right, float bottom) throws IOException {
            super();
            this.right = right;
            this.bottom = bottom;
        }

        @Override
        protected void writeString(String text, List<TextPosition> positions) throws IOException {
            for (TextPosition position : positions) {
                assertThat(position.getXDirAdj()).isGreaterThanOrEqualTo(40);
                assertThat(position.getXDirAdj() + position.getWidthDirAdj()).isLessThanOrEqualTo(right);
                assertThat(position.getYDirAdj()).isBetween(35f, bottom);
            }
            super.writeString(text, positions);
        }
    }
}
