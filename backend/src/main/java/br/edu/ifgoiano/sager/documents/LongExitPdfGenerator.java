package br.edu.ifgoiano.sager.documents;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Renders the immutable server snapshot for one long-exit document revision. */
@Component
@Profile("local")
public class LongExitPdfGenerator {
    public static final String TERM_VERSION = "SAGER-SAIDA-LONGA-LOCAL-v1";
    private static final DateTimeFormatter BIRTH_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter PERIOD = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("America/Sao_Paulo"));
    private final PdfTextRenderer renderer;

    public LongExitPdfGenerator(PdfTextRenderer renderer) {
        this.renderer = renderer;
    }

    public byte[] generate(Snapshot snapshot) {
        if (snapshot == null || snapshot.documentVersionId() == null || snapshot.exitId() == null
                || snapshot.revisionNumber() < 1 || snapshot.birthDate() == null
                || snapshot.departure() == null || snapshot.expectedReturn() == null
                || !snapshot.expectedReturn().isAfter(snapshot.departure())
                || !present(snapshot.residentName()) || !present(snapshot.enrollment())
                || !present(snapshot.roomNumber()) || !present(snapshot.accommodationName())
                || !present(snapshot.reason()) || !present(snapshot.guardianName())
                || !present(snapshot.guardianRelationship())) {
            throw new PdfGenerationException();
        }
        var sections = List.of(
                section("Documento", "Documento: " + snapshot.documentVersionId(),
                        "Solicitação: " + snapshot.exitId()),
                section("Residente e alocação", "Residente: " + snapshot.residentName(),
                        "Matrícula: " + snapshot.enrollment() + " | Nascimento: " + BIRTH_DATE.format(snapshot.birthDate()),
                        "Quarto " + snapshot.roomNumber() + " | " + snapshot.accommodationName()),
                section("Responsável indicado", "Responsável: " + snapshot.guardianName(),
                        "Vínculo: " + snapshot.guardianRelationship()),
                section("Período solicitado", "Partida: " + PERIOD.format(snapshot.departure()),
                        "Retorno previsto: " + PERIOD.format(snapshot.expectedReturn()) + " (horário de São Paulo)"),
                section("Motivo", snapshot.reason()),
                section("Observações", present(snapshot.notes()) ? snapshot.notes() : "Sem observações."),
                section("Termo de autorização", "Versão do termo: " + TERM_VERSION,
                        "Declaro que recebi as informações sobre o período, o motivo e as observações desta solicitação "
                                + "e autorizo a saída do residente identificado neste documento, limitada aos dados e à revisão apresentados.",
                        "Estou ciente de que a saída depende da aprovação do supervisor e da confirmação dos movimentos físicos "
                                + "no SAGER. A assinatura, por si só, não aprova a saída.",
                        "Alterações no período ou nos dados da solicitação exigem nova revisão documental e nova autorização."));
        return renderer.render(new PdfTextRenderer.Document("Autorização de saída longa",
                "Revisão " + snapshot.revisionNumber() + " | Termo local de autorização", sections));
    }

    private static PdfTextRenderer.Section section(String heading, String... paragraphs) {
        return new PdfTextRenderer.Section(heading, List.of(paragraphs));
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    public record Snapshot(UUID documentVersionId, UUID exitId, int revisionNumber,
            String residentName, String enrollment, LocalDate birthDate, String roomNumber,
            String accommodationName, Instant departure, Instant expectedReturn, String reason,
            String notes, String guardianName, String guardianRelationship) {}
}
