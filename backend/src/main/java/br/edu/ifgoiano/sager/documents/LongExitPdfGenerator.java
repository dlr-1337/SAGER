package br.edu.ifgoiano.sager.documents;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Renders the immutable server snapshot for one long-exit document revision. */
@Component
@Profile({ "local", "production" })
public class LongExitPdfGenerator {
    public static final String TERM_VERSION = "SAGER-SAIDA-LONGA-v2";
    private static final DateTimeFormatter PERIOD = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("America/Sao_Paulo"));
    private final PdfTextRenderer renderer;

    public LongExitPdfGenerator(PdfTextRenderer renderer) {
        this.renderer = renderer;
    }

    public byte[] generate(Snapshot snapshot) {
        if (snapshot == null || snapshot.documentVersionId() == null || snapshot.exitId() == null
                || snapshot.revisionNumber() < 1
                || snapshot.departure() == null || snapshot.expectedReturn() == null
                || !snapshot.expectedReturn().isAfter(snapshot.departure())
                || !present(snapshot.residentName()) || !present(snapshot.reason())
                || !present(snapshot.guardianName())) {
            throw new PdfGenerationException();
        }
        var sections = List.of(
                section("Documento", "Código: " + shortCode(snapshot.documentVersionId())
                        + " | Revisão " + snapshot.revisionNumber()),
                section("Residente", "Residente: " + snapshot.residentName()),
                section("Responsável indicado", "Responsável: " + snapshot.guardianName()),
                section("Período solicitado", "Partida: " + PERIOD.format(snapshot.departure()),
                        "Retorno previsto: " + PERIOD.format(snapshot.expectedReturn()) + " (horário de São Paulo)"),
                section("Motivo", snapshot.reason()),
                section("Termo de autorização", "Versão do termo: " + TERM_VERSION,
                        "Declaro que recebi as informações sobre o período e o motivo desta solicitação "
                                + "e autorizo a saída do residente identificado neste documento, limitada aos dados e à revisão apresentados.",
                        "Estou ciente de que a saída depende da conferência deste documento por um servidor, da aprovação do supervisor "
                                + "e da confirmação dos movimentos físicos no SAGER. A assinatura, por si só, não aprova a saída.",
                        "Alterações no período ou nos dados da solicitação exigem nova revisão documental e nova autorização."),
                section("Assinatura do responsável", "Assinatura: ________________________________________",
                        "Data: ____/____/________"));
        return renderer.render(new PdfTextRenderer.Document("Autorização de saída longa",
                "Revisão " + snapshot.revisionNumber() + " | Termo local de autorização", sections));
    }

    /** Printed on the document and quoted in the message, so a person can match them at a glance. */
    public static String shortCode(UUID documentVersionId) {
        return documentVersionId.toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private static PdfTextRenderer.Section section(String heading, String... paragraphs) {
        return new PdfTextRenderer.Section(heading, List.of(paragraphs));
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Snapshot(UUID documentVersionId, UUID exitId, int revisionNumber,
            String residentName, Instant departure, Instant expectedReturn, String reason,
            String guardianName) {}
}
