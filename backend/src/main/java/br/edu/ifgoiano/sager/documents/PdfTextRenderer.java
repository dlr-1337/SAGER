package br.edu.ifgoiano.sager.documents;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Offline text renderer shared by document features. No host fonts or network access are used. */
@Component
@Profile("local")
public class PdfTextRenderer {
    private static final float MARGIN = 48;
    private static final float BODY_BOTTOM = 77;
    private static final float BODY_SIZE = 10.5f;
    private static final float BODY_LEADING = 14.5f;
    private static final Color INK = new Color(35, 45, 49);
    private static final Color MUTED = new Color(86, 102, 107);
    private static final Color ACCENT = new Color(21, 76, 81);
    private static final int MAX_CHARACTERS = 2_000_000;
    private static final int MAX_PAGES = 1000;

    public byte[] render(Document content) {
        validateContent(content);
        try (PDDocument pdf = new PDDocument()) {
            PDType0Font regular = loadFont(pdf, "/fonts/SourceSans3-Regular.ttf");
            PDType0Font semibold = loadFont(pdf, "/fonts/SourceSans3-Semibold.ttf");
            pdf.getDocumentInformation().setTitle(content.title());
            pdf.getDocumentInformation().setAuthor("SAGER - IF Goiano");
            pdf.getDocumentInformation().setCreator("SAGER PDFBox 3");
            try (Layout layout = new Layout(pdf, regular, semibold, content)) {
                layout.newPage(true);
                for (Section section : content.sections()) {
                    layout.section(section);
                }
            }
            addPageNumbers(pdf, regular);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            pdf.save(bytes);
            return bytes.toByteArray();
        } catch (IOException | IllegalArgumentException exception) {
            throw new PdfGenerationException();
        }
    }

    public record Document(String title, String subtitle, List<Section> sections) {
        public Document {
            sections = List.copyOf(sections);
        }
    }

    public record Section(String heading, List<String> paragraphs) {
        public Section {
            paragraphs = List.copyOf(paragraphs);
        }
    }

    private static void validateContent(Document document) {
        if (document == null || document.title() == null || document.title().isBlank()
                || document.title().length() > 180
                || document.subtitle() != null && document.subtitle().length() > 512
                || document.sections().isEmpty()) {
            throw new PdfGenerationException();
        }
        long characters = document.title().length()
                + (document.subtitle() == null ? 0 : document.subtitle().length());
        for (Section section : document.sections()) {
            if (section.heading() == null || section.heading().isBlank() || section.heading().length() > 120
                    || section.paragraphs().isEmpty()) {
                throw new PdfGenerationException();
            }
            characters += section.heading().length();
            for (String paragraph : section.paragraphs()) {
                if (paragraph == null) {
                    throw new PdfGenerationException();
                }
                characters += paragraph.length();
            }
        }
        if (characters > MAX_CHARACTERS) {
            throw new PdfGenerationException();
        }
    }

    private static PDType0Font loadFont(PDDocument pdf, String resource) throws IOException {
        try (InputStream bytes = PdfTextRenderer.class.getResourceAsStream(resource)) {
            if (bytes == null) {
                throw new PdfGenerationException();
            }
            return PDType0Font.load(pdf, bytes, true);
        }
    }

    private static void addPageNumbers(PDDocument pdf, PDType0Font regular) throws IOException {
        for (int index = 0; index < pdf.getNumberOfPages(); index++) {
            PDPage page = pdf.getPage(index);
            try (PDPageContentStream stream = new PDPageContentStream(pdf, page,
                    PDPageContentStream.AppendMode.APPEND, true, true)) {
                stream.setStrokingColor(new Color(207, 216, 218));
                stream.setLineWidth(0.5f);
                stream.moveTo(MARGIN, 61);
                stream.lineTo(page.getMediaBox().getWidth() - MARGIN, 61);
                stream.stroke();
                text(stream, regular, 8, MARGIN, 44, "Documento SAGER", MUTED);
                String number = "Página " + (index + 1) + " de " + pdf.getNumberOfPages();
                float width = regular.getStringWidth(number) / 1000 * 8;
                text(stream, regular, 8, page.getMediaBox().getWidth() - MARGIN - width, 44,
                        number, MUTED);
            }
        }
    }

    private static void text(PDPageContentStream stream, PDType0Font font, float size, float x,
            float y, String value, Color color) throws IOException {
        stream.beginText();
        stream.setFont(font, size);
        stream.setNonStrokingColor(color);
        stream.newLineAtOffset(x, y);
        stream.showText(value);
        stream.endText();
    }

    private static final class Layout implements AutoCloseable {
        private final PDDocument pdf;
        private final PDType0Font regular;
        private final PDType0Font semibold;
        private final Document document;
        private final Map<PDType0Font, Map<Integer, Float>> glyphWidths = new HashMap<>();
        private PDPageContentStream stream;
        private float y;
        private float width;

        private Layout(PDDocument pdf, PDType0Font regular, PDType0Font semibold, Document document) {
            this.pdf = pdf;
            this.regular = regular;
            this.semibold = semibold;
            this.document = document;
        }

        private void newPage(boolean first) throws IOException {
            close();
            if (pdf.getNumberOfPages() >= MAX_PAGES) {
                throw new PdfGenerationException();
            }
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            stream = new PDPageContentStream(pdf, page);
            width = page.getMediaBox().getWidth() - 2 * MARGIN;
            y = page.getMediaBox().getHeight() - MARGIN;
            text(stream, semibold, 9, MARGIN, y, "IF Goiano | SAGER", ACCENT);
            y -= 26;
            if (first) {
                paragraph(document.title(), semibold, 18, 24, INK);
                if (document.subtitle() != null && !document.subtitle().isBlank()) {
                    paragraph(document.subtitle(), regular, 9, 13, MUTED);
                }
                y -= 9;
            } else {
                paragraph(document.title(), semibold, 10, 14, MUTED);
                y -= 8;
            }
        }

        private void section(Section section) throws IOException {
            List<String> heading = wrap(section.heading(), semibold, 11.5f);
            // Keep the heading and the first body line together whenever a page break is needed.
            ensureSpace(heading.size() * 16 + BODY_LEADING + 6);
            for (String line : heading) {
                line(line, semibold, 11.5f, 16, ACCENT);
            }
            y -= 3;
            for (int index = 0; index < section.paragraphs().size(); index++) {
                paragraph(section.paragraphs().get(index), regular, BODY_SIZE, BODY_LEADING, INK);
                if (index + 1 < section.paragraphs().size()) {
                    y -= 3;
                }
            }
            y -= 13;
        }

        private void paragraph(String value, PDType0Font font, float size, float leading, Color color)
                throws IOException {
            for (String line : wrap(value, font, size)) {
                line(line, font, size, leading, color);
            }
        }

        private void line(String value, PDType0Font font, float size, float leading, Color color)
                throws IOException {
            ensureSpace(leading);
            if (!value.isEmpty()) {
                text(stream, font, size, MARGIN, y, value, color);
            }
            y -= leading;
        }

        private void ensureSpace(float height) throws IOException {
            if (y - height < BODY_BOTTOM) {
                newPage(false);
            }
        }

        private List<String> wrap(String raw, PDType0Font font, float size) throws IOException {
            String normalized = raw.replace("\r\n", "\n").replace('\r', '\n').replace('\t', ' ');
            List<String> lines = new ArrayList<>();
            for (String logicalLine : normalized.split("\n", -1)) {
                int[] points = logicalLine.codePoints().toArray();
                if (points.length == 0) {
                    lines.add("");
                    continue;
                }
                int start = 0;
                while (start < points.length) {
                    float used = 0;
                    int end = start;
                    int lastSpace = -1;
                    while (end < points.length) {
                        int point = points[end];
                        if (Character.isISOControl(point)) {
                            throw new PdfGenerationException();
                        }
                        float glyph = glyphWidth(font, point) * size;
                        if (used + glyph > width) {
                            break;
                        }
                        used += glyph;
                        if (Character.isWhitespace(point)) {
                            lastSpace = end;
                        }
                        end++;
                    }
                    if (end == start) {
                        throw new PdfGenerationException();
                    }
                    int cut = end < points.length && lastSpace >= start ? lastSpace : end;
                    lines.add(new String(points, start, cut - start).stripTrailing());
                    start = cut;
                    while (start < points.length && Character.isWhitespace(points[start])) {
                        start++;
                    }
                }
            }
            return lines;
        }

        private float glyphWidth(PDType0Font font, int codePoint) throws IOException {
            Map<Integer, Float> widths = glyphWidths.computeIfAbsent(font, unused -> new HashMap<>());
            Float cached = widths.get(codePoint);
            if (cached != null) {
                return cached;
            }
            float width = font.getStringWidth(new String(Character.toChars(codePoint))) / 1000;
            widths.put(codePoint, width);
            return width;
        }

        @Override
        public void close() throws IOException {
            if (stream != null) {
                stream.close();
                stream = null;
            }
        }
    }
}
