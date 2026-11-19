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
@Profile({ "local", "production" })
public class PdfTextRenderer {
    private static final float MARGIN = 48;
    private static final float BODY_BOTTOM = 77;
    private static final float BODY_SIZE = 10.5f;
    private static final float BODY_LEADING = 14.5f;
    private static final float TABLE_SIZE = 8.5f;
    private static final float TABLE_LEADING = 10.5f;
    private static final float CELL_PADDING = 3.5f;
    private static final Color INK = new Color(35, 45, 49);
    private static final Color MUTED = new Color(86, 102, 107);
    private static final Color ACCENT = new Color(21, 76, 81);
    private static final Color RULE = new Color(207, 216, 218);
    private static final Color HEADER_FILL = new Color(226, 236, 237);
    private static final Color STRIPE_FILL = new Color(245, 248, 248);
    private static final int MAX_CHARACTERS = 2_000_000;
    private static final int MAX_PAGES = 1000;
    private static final int MAX_COLUMNS = 12;

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

    /** {@code landscape} turns every page of the document to A4 lying down, for wide tables. */
    public record Document(String title, String subtitle, List<Section> sections, boolean landscape) {
        public Document {
            sections = List.copyOf(sections);
        }

        public Document(String title, String subtitle, List<Section> sections) {
            this(title, subtitle, sections, false);
        }
    }

    /** Paragraphs come first; the optional table follows them. A section needs one of the two. */
    public record Section(String heading, List<String> paragraphs, Table table) {
        public Section {
            paragraphs = List.copyOf(paragraphs);
        }

        public Section(String heading, List<String> paragraphs) {
            this(heading, paragraphs, null);
        }
    }

    /** One line per record; the header repeats on every page and long values wrap inside the cell. */
    public record Table(List<String> headers, List<List<String>> rows) {
        public Table {
            headers = List.copyOf(headers);
            rows = rows.stream().map(List::copyOf).toList();
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
                    || section.paragraphs().isEmpty() && section.table() == null) {
                throw new PdfGenerationException();
            }
            characters += section.heading().length();
            for (String paragraph : section.paragraphs()) {
                if (paragraph == null) {
                    throw new PdfGenerationException();
                }
                characters += paragraph.length();
            }
            if (section.table() != null) {
                characters += tableCharacters(section.table());
            }
        }
        if (characters > MAX_CHARACTERS) {
            throw new PdfGenerationException();
        }
    }

    private static long tableCharacters(Table table) {
        if (table.headers().isEmpty() || table.headers().size() > MAX_COLUMNS) {
            throw new PdfGenerationException();
        }
        long characters = 0;
        for (String header : table.headers()) {
            if (header == null || header.isBlank()) {
                throw new PdfGenerationException();
            }
            characters += header.length();
        }
        for (List<String> row : table.rows()) {
            if (row.size() != table.headers().size()) {
                throw new PdfGenerationException();
            }
            for (String cell : row) {
                if (cell == null) {
                    throw new PdfGenerationException();
                }
                characters += cell.length();
            }
        }
        return characters;
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
                stream.setStrokingColor(RULE);
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
            PDRectangle size = document.landscape()
                    ? new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth())
                    : PDRectangle.A4;
            PDPage page = new PDPage(size);
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
            float[] columns = section.table() == null ? null : columnWidths(section.table());
            List<String> heading = wrap(section.heading(), semibold, 11.5f, width);
            // Keep the heading and the first body line, or the table header and first record, together.
            float first = section.paragraphs().isEmpty() ? 3 + tableStart(section.table(), columns)
                    : BODY_LEADING;
            ensureSpace(heading.size() * 16 + first + 6);
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
            if (section.table() != null) {
                if (!section.paragraphs().isEmpty()) {
                    y -= 6;
                }
                table(section.table(), columns);
            }
            y -= 13;
        }

        private void table(Table table, float[] columns) throws IOException {
            List<List<String>> header = cells(table.headers(), semibold, columns);
            float headerHeight = rowHeight(header);
            if (y - tableStart(table, columns) < BODY_BOTTOM) {
                newPage(false);
            }
            row(header, columns, semibold, headerHeight, HEADER_FILL);
            for (int index = 0; index < table.rows().size(); index++) {
                List<List<String>> cells = cells(table.rows().get(index), regular, columns);
                float height = rowHeight(cells);
                if (y - height < BODY_BOTTOM) {
                    newPage(false);
                    row(header, columns, semibold, headerHeight, HEADER_FILL);
                    if (y - height < BODY_BOTTOM) {
                        // A single record taller than a page cannot be shown whole.
                        throw new PdfGenerationException();
                    }
                }
                row(cells, columns, regular, height, index % 2 == 1 ? STRIPE_FILL : null);
            }
        }

        private float tableStart(Table table, float[] columns) throws IOException {
            float height = rowHeight(cells(table.headers(), semibold, columns));
            if (!table.rows().isEmpty()) {
                height += rowHeight(cells(table.rows().getFirst(), regular, columns));
            }
            return height;
        }

        /**
         * A column whose content fits in its share keeps its natural width (date, room, score); the
         * others split what is left and wrap. When everything fits, the spare width follows the content.
         */
        private float[] columnWidths(Table table) throws IOException {
            int count = table.headers().size();
            float[] natural = new float[count];
            for (int column = 0; column < count; column++) {
                natural[column] = textWidth(table.headers().get(column), semibold);
            }
            for (List<String> row : table.rows()) {
                for (int column = 0; column < count; column++) {
                    natural[column] = Math.max(natural[column], textWidth(row.get(column), regular));
                }
            }
            float total = 0;
            for (int column = 0; column < count; column++) {
                natural[column] += 2 * CELL_PADDING + 1;
                total += natural[column];
            }
            float[] widths = new float[count];
            boolean[] fixed = new boolean[count];
            float remaining = width;
            int open = count;
            boolean changed = true;
            while (changed && open > 0) {
                changed = false;
                float share = remaining / open;
                for (int column = 0; column < count; column++) {
                    if (!fixed[column] && natural[column] <= share) {
                        widths[column] = natural[column];
                        fixed[column] = true;
                        remaining -= natural[column];
                        open--;
                        changed = true;
                    }
                }
            }
            for (int column = 0; column < count; column++) {
                widths[column] = open > 0
                        ? fixed[column] ? widths[column] : remaining / open
                        : widths[column] + remaining * natural[column] / total;
            }
            return widths;
        }

        private float textWidth(String value, PDType0Font font) throws IOException {
            float result = 0;
            for (int point : value.codePoints().toArray()) {
                if (!Character.isISOControl(point)) {
                    result += glyphWidth(font, point) * TABLE_SIZE;
                }
            }
            return result;
        }

        private List<List<String>> cells(List<String> values, PDType0Font font, float[] columns)
                throws IOException {
            List<List<String>> result = new ArrayList<>(values.size());
            for (int column = 0; column < values.size(); column++) {
                result.add(wrap(values.get(column), font, TABLE_SIZE, columns[column] - 2 * CELL_PADDING));
            }
            return result;
        }

        private static float rowHeight(List<List<String>> cells) {
            int lines = 1;
            for (List<String> cell : cells) {
                lines = Math.max(lines, cell.size());
            }
            return 2 * CELL_PADDING + TABLE_SIZE * 1.05f + (lines - 1) * TABLE_LEADING;
        }

        private void row(List<List<String>> cells, float[] columns, PDType0Font font, float height, Color fill)
                throws IOException {
            float top = y;
            if (fill != null) {
                stream.setNonStrokingColor(fill);
                stream.addRect(MARGIN, top - height, width, height);
                stream.fill();
            }
            float x = MARGIN;
            for (int column = 0; column < cells.size(); column++) {
                float baseline = top - CELL_PADDING - TABLE_SIZE * 0.8f;
                for (String line : cells.get(column)) {
                    if (!line.isEmpty()) {
                        text(stream, font, TABLE_SIZE, x + CELL_PADDING, baseline, line, INK);
                    }
                    baseline -= TABLE_LEADING;
                }
                x += columns[column];
            }
            stream.setStrokingColor(RULE);
            stream.setLineWidth(0.5f);
            stream.moveTo(MARGIN, top - height);
            stream.lineTo(MARGIN + width, top - height);
            stream.stroke();
            y = top - height;
        }

        private void paragraph(String value, PDType0Font font, float size, float leading, Color color)
                throws IOException {
            for (String line : wrap(value, font, size, width)) {
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

        private List<String> wrap(String raw, PDType0Font font, float size, float available) throws IOException {
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
                        if (used + glyph > available) {
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
