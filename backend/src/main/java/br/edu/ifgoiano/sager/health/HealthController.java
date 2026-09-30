package br.edu.ifgoiano.sager.health;

import static br.edu.ifgoiano.sager.health.HealthModels.*;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@Profile({ "local", "production" })
@RequestMapping("/api/v1")
public class HealthController {
    private static final Pattern UUID_TEXT = Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern HTML = Pattern.compile("<[A-Za-z!/][^>]*>");
    private static final Set<String> REGIONS = Set.of("AC", "AL", "AP", "AM", "BA", "CE", "DF",
            "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
            "RS", "RO", "RR", "SC", "SP", "SE", "TO");
    private final HealthService service;

    public HealthController(HealthService service) { this.service = service; }

    @GetMapping("/saude/me")
    public ResponseEntity<Capabilities> capabilities() { return ok(service.capabilities()); }

    @GetMapping("/saude/contas")
    public ResponseEntity<Page<AccountChoice>> accounts(@RequestParam(required = false) String q,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) UUID afterId) {
        return ok(service.accounts(q, afterId, limit));
    }

    @GetMapping("/saude/habilitacoes")
    public ResponseEntity<Page<Grant>> grants(@RequestParam(required = false) UUID accountId,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) Long beforeSequence) {
        return ok(service.grants(accountId, limit, beforeSequence));
    }

    @PostMapping("/saude/habilitacoes")
    public ResponseEntity<Grant> createGrant(@RequestBody GrantRequest request) {
        required(request);
        Grant grant = service.createGrant(uuid(request.accountId(), "accountId"),
                profession(request.profession()), text(request.registrationNumber(), "registrationNumber", 1, 100),
                region(request.registrationRegion()), reason(request.verificationReason(), "verificationReason"));
        return created("/api/v1/saude/habilitacoes/", grant.id(), grant);
    }

    @PostMapping("/saude/habilitacoes/{id}/revogacao")
    public ResponseEntity<Grant> endGrant(@PathVariable UUID id, @RequestBody ReasonRequest request) {
        required(request);
        return ok(service.endGrant(id, version(request.version()), reason(request.reason(), "reason")));
    }

    @GetMapping("/saude/vinculos")
    public ResponseEntity<Page<Assignment>> assignments(@RequestParam(required = false) UUID residentId,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) Long beforeSequence) {
        return ok(service.assignments(residentId, limit, beforeSequence));
    }

    @PostMapping("/saude/vinculos")
    public ResponseEntity<Assignment> createAssignment(@RequestBody AssignmentRequest request) {
        required(request);
        Assignment assignment = service.createAssignment(uuid(request.residentId(), "residentId"),
                uuid(request.professionalGrantId(), "professionalGrantId"), reason(request.reason(), "reason"));
        return created("/api/v1/saude/vinculos/", assignment.id(), assignment);
    }

    @PostMapping("/saude/vinculos/{id}/encerramento")
    public ResponseEntity<Assignment> endAssignment(@PathVariable UUID id, @RequestBody ReasonRequest request) {
        required(request);
        return ok(service.endAssignment(id, version(request.version()), reason(request.reason(), "reason")));
    }

    @GetMapping("/saude/custodias")
    public ResponseEntity<Page<Custody>> custodies(@RequestParam(required = false) UUID residentId,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) Long beforeSequence) {
        return ok(service.custodies(residentId, limit, beforeSequence));
    }

    @PostMapping("/saude/custodias")
    public ResponseEntity<Custody> createCustody(@RequestBody CustodyRequest request) {
        required(request);
        Custody custody = service.createCustody(uuid(request.residentId(), "residentId"),
                uuid(request.sourceAuthorAccountId(), "sourceAuthorAccountId"),
                uuid(request.recipientGrantId(), "recipientGrantId"), reason(request.reason(), "reason"));
        return created("/api/v1/saude/custodias/", custody.id(), custody);
    }

    @PostMapping("/saude/custodias/{id}/encerramento")
    public ResponseEntity<Custody> endCustody(@PathVariable UUID id, @RequestBody ReasonRequest request) {
        required(request);
        return ok(service.endCustody(id, version(request.version()), reason(request.reason(), "reason")));
    }

    @GetMapping("/saude/residentes")
    public ResponseEntity<Page<ResidentHeader>> residents(@RequestParam(required = false) String q,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) UUID afterId) {
        return ok(service.residents(q, afterId, limit));
    }

    @GetMapping("/saude/residentes/{id}")
    public ResponseEntity<ResidentHeader> resident(@PathVariable UUID id) {
        return ok(service.resident(id));
    }

    @GetMapping("/saude/residentes/{id}/profissionais")
    public ResponseEntity<ProfessionalChoices> professionals(@PathVariable UUID id,
            @RequestParam(defaultValue = "SHARED_SUMMARY") Category category) {
        return ok(service.professionals(id, category));
    }

    @GetMapping("/saude/residentes/{id}/notas")
    public ResponseEntity<Page<NoteSummary>> notes(@PathVariable UUID id,
            @RequestParam(required = false) Category category, @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) Long beforeSequence) {
        return ok(service.notes(id, category, limit, beforeSequence, false));
    }

    @PostMapping("/saude/residentes/{id}/notas")
    public ResponseEntity<NoteDetail> createNote(@PathVariable UUID id, @RequestBody NoteRequest request) {
        required(request);
        NoteDetail note = service.createNote(id, category(request.category()), body(request.body()),
                optionalUuid(request.relatedNoteId(), "relatedNoteId"));
        return created("/api/v1/saude/notas/", note.id(), note);
    }

    @GetMapping("/saude/notas/{id}")
    public ResponseEntity<NoteDetail> note(@PathVariable UUID id) { return ok(service.note(id, false)); }

    @GetMapping("/saude/notas/{id}/historico")
    public ResponseEntity<Page<Revision>> history(@PathVariable UUID id,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) Long beforeVersion) {
        return ok(service.history(id, limit, beforeVersion, false));
    }

    @PostMapping("/saude/notas/{id}/correcoes")
    public ResponseEntity<NoteDetail> correct(@PathVariable UUID id, @RequestBody CorrectionRequest request) {
        required(request);
        return ok(service.correct(id, version(request.version()), body(request.body()), reason(request.reason(), "reason")));
    }

    @PostMapping("/saude/notas/{id}/partilhas")
    public ResponseEntity<NoteDetail> share(@PathVariable UUID id, @RequestBody ShareRequest request) {
        required(request);
        return ok(service.share(id, version(request.version()), uuidArray(request.recipientGrantIds())));
    }

    @PostMapping("/saude/notas/{id}/partilhas/{shareId}/revogacao")
    public ResponseEntity<NoteDetail> endShare(@PathVariable UUID id, @PathVariable UUID shareId,
            @RequestBody VersionRequest request) {
        required(request);
        return ok(service.endShare(id, shareId, version(request.version())));
    }

    @GetMapping("/minha-saude/notas")
    public ResponseEntity<Page<NoteSummary>> ownNotes(@RequestParam(required = false) Category category,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) Long beforeSequence) {
        return ok(service.notes(null, category, limit, beforeSequence, true));
    }

    @GetMapping("/minha-saude/notas/{id}")
    public ResponseEntity<NoteDetail> ownNote(@PathVariable UUID id) { return ok(service.note(id, true)); }

    @GetMapping("/minha-saude/notas/{id}/historico")
    public ResponseEntity<Page<Revision>> ownHistory(@PathVariable UUID id,
            @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) Long beforeVersion) {
        return ok(service.history(id, limit, beforeVersion, true));
    }

    @PostMapping("/saude/residentes/{id}/exportacoes")
    public ResponseEntity<Export> export(@PathVariable UUID id, @RequestBody(required = false) JsonNode request) {
        emptyRequest(request);
        return exportResponse(service.export(id, false));
    }

    @PostMapping("/minha-saude/exportacoes")
    public ResponseEntity<Export> ownExport(@RequestBody(required = false) JsonNode request) {
        emptyRequest(request);
        return exportResponse(service.export(null, true));
    }

    private <T> ResponseEntity<T> ok(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    private <T> ResponseEntity<T> created(String path, UUID id, T body) {
        return ResponseEntity.created(URI.create(path + id)).cacheControl(CacheControl.noStore()).body(body);
    }

    private ResponseEntity<Export> exportResponse(Export export) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_JSON)
                .header("Content-Disposition", "attachment; filename=\"sager-health-" + export.exportId() + ".json\"")
                .body(export);
    }

    private String text(JsonNode value, String field, int minimum, int maximum) {
        if (value == null || !value.isString()) throw invalid(field + " deve ser texto JSON.");
        String raw = value.stringValue();
        for (int index = 0; index < raw.length(); index++) {
            char character = raw.charAt(index);
            if (character == '\0' || Character.isLowSurrogate(character))
                throw invalid(field + " contém caracteres inválidos.");
            if (Character.isHighSurrogate(character)) {
                if (index + 1 >= raw.length() || !Character.isLowSurrogate(raw.charAt(index + 1)))
                    throw invalid(field + " contém caracteres inválidos.");
                index++;
            }
        }
        String text = raw.trim();
        int length = text.codePointCount(0, text.length());
        if (length < minimum || length > maximum)
            throw invalid(field + " deve ter entre " + minimum + " e " + maximum + " caracteres.");
        return text;
    }

    private String body(JsonNode value) {
        String body = text(value, "body", 1, 4000);
        if (HTML.matcher(body).find()) throw invalid("Informe somente texto simples, sem HTML.");
        return body;
    }

    private String reason(JsonNode value, String field) { return text(value, field, 10, 500); }

    private String region(JsonNode value) {
        String region = text(value, "registrationRegion", 2, 2).toUpperCase(Locale.ROOT);
        if (!REGIONS.contains(region)) throw invalid("Informe uma UF brasileira válida.");
        return region;
    }

    private Profession profession(JsonNode value) {
        try { return Profession.valueOf(text(value, "profession", 1, 32)); }
        catch (IllegalArgumentException error) { throw invalid("Profissão inválida."); }
    }

    private Category category(JsonNode value) {
        try { return Category.valueOf(text(value, "category", 1, 32)); }
        catch (IllegalArgumentException error) { throw invalid("Categoria inválida."); }
    }

    private UUID uuid(JsonNode value, String field) {
        String text = text(value, field, 36, 36);
        if (!UUID_TEXT.matcher(text).matches()) throw invalid(field + " deve ser UUID válido.");
        return UUID.fromString(text);
    }

    private UUID optionalUuid(JsonNode value, String field) {
        return value == null || value.isNull() ? null : uuid(value, field);
    }

    private long version(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong()
                || value.asLong() < 0 || value.asLong() == Long.MAX_VALUE)
            throw invalid("version deve ser inteiro JSON não negativo válido.");
        return value.asLong();
    }

    private List<UUID> uuidArray(JsonNode values) {
        if (values == null || !values.isArray() || values.size() < 1 || values.size() > 100)
            throw invalid("recipientGrantIds deve conter entre 1 e 100 UUIDs.");
        List<UUID> ids = new ArrayList<>();
        for (int index = 0; index < values.size(); index++) ids.add(uuid(values.get(index), "recipientGrantIds"));
        if (new HashSet<>(ids).size() != ids.size()) throw invalid("Não repita destinatários.");
        return ids;
    }

    private void required(Object request) {
        if (request == null) throw invalid("Informe um objeto JSON.");
    }

    private void emptyRequest(JsonNode request) {
        if (request != null && !request.isNull() && (!request.isObject() || !request.isEmpty()))
            throw invalid("Esta exportação não aceita parâmetros de residente ou conteúdo.");
    }

    private HealthApiException invalid(String message) {
        return new HealthApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    public record GrantRequest(JsonNode accountId, JsonNode profession, JsonNode registrationNumber,
            JsonNode registrationRegion, JsonNode verificationReason) {}
    public record AssignmentRequest(JsonNode residentId, JsonNode professionalGrantId, JsonNode reason) {}
    public record CustodyRequest(JsonNode residentId, JsonNode sourceAuthorAccountId,
            JsonNode recipientGrantId, JsonNode reason) {}
    public record ReasonRequest(JsonNode version, JsonNode reason) {}
    public record VersionRequest(JsonNode version) {}
    public record NoteRequest(JsonNode category, JsonNode body, JsonNode relatedNoteId) {}
    public record CorrectionRequest(JsonNode version, JsonNode body, JsonNode reason) {}
    public record ShareRequest(JsonNode version, JsonNode recipientGrantIds) {}
}
