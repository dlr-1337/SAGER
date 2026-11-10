package br.edu.ifgoiano.sager.conversations;

import br.edu.ifgoiano.sager.conversations.ConversationRepository.Message;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.OpenExit;
import br.edu.ifgoiano.sager.conversations.ConversationService.Conversation;
import br.edu.ifgoiano.sager.conversations.ConversationService.Page;
import br.edu.ifgoiano.sager.conversations.ConversationService.Sent;
import br.edu.ifgoiano.sager.conversations.ConversationService.SessionView;
import br.edu.ifgoiano.sager.operations.OpsInput;
import br.edu.ifgoiano.sager.operations.longexits.LongExit;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import br.edu.ifgoiano.sager.integrations.ConversationFileType;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/conversas")
@Profile({ "local", "production" })
public class ConversationController {
    private final ConversationService service;

    public ConversationController(ConversationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<Page<Conversation>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String before,
            @RequestParam(defaultValue = "30") int limit) {
        return ok(service.list(q, before, limit));
    }

    @PostMapping
    public ResponseEntity<Conversation> start(@RequestBody JsonNode body) {
        OpsInput.object(body, "guardianId");
        var started = service.start(OpsInput.uuid(body, "guardianId"));
        return ResponseEntity.status(started.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .cacheControl(CacheControl.noStore())
                .body(started.conversation());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Conversation> read(@PathVariable UUID id) {
        return ok(service.read(id));
    }

    @PostMapping("/{id}/leitura")
    public ResponseEntity<Void> markRead(@PathVariable UUID id) {
        service.markRead(id);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/{id}/mensagens")
    public ResponseEntity<Page<Message>> history(
            @PathVariable UUID id,
            @RequestParam(required = false) String before,
            @RequestParam(defaultValue = "50") int limit) {
        return ok(service.history(id, before, limit));
    }

    @PostMapping(value = "/{id}/mensagens", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Message> sendText(
            @PathVariable UUID id,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @RequestBody JsonNode body) {
        OpsInput.object(body, "text");
        return sent(
                service.sendText(
                        id,
                        key,
                        OpsInput.text(body, "text", true, 1, ConversationService.MAX_TEXT)));
    }

    @PostMapping(value = "/{id}/mensagens", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Message> sendFile(
            @PathVariable UUID id,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "text", required = false) String text)
            throws IOException {
        return sent(
                service.sendFile(
                        id,
                        key,
                        text,
                        file.getBytes(),
                        file.getContentType(),
                        file.getOriginalFilename()));
    }

    @GetMapping("/{id}/saidas-abertas")
    public ResponseEntity<List<OpenExit>> openExits(@PathVariable UUID id) {
        return ok(service.openExits(id));
    }

    // No extension in the path: the proxy's static-file rule would otherwise take the request.
    @GetMapping("/mensagens/{id}/midia")
    public ResponseEntity<byte[]> media(@PathVariable UUID id) {
        var media = service.media(id);
        boolean inline =
                media.mediaType().startsWith("image/") || media.mediaType().startsWith("audio/");
        String name = ConversationFileType.safeName(media.filename(), media.mediaType());
        return file(
                MediaType.parseMediaType(media.mediaType()),
                (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                        .filename(name, StandardCharsets.UTF_8)
                        .build(),
                media.bytes());
    }

    @PostMapping("/mensagens/{id}/vinculo")
    public ResponseEntity<LongExit> link(@PathVariable UUID id, @RequestBody JsonNode body) {
        OpsInput.object(body, "exitId", "version");
        return ok(service.link(id, OpsInput.uuid(body, "exitId"), OpsInput.version(body)));
    }

    @GetMapping("/sessao")
    public ResponseEntity<SessionView> session() {
        return ok(service.session());
    }

    @PostMapping("/sessao/inicio")
    public ResponseEntity<SessionView> startSession() {
        return ok(service.startSession());
    }

    @GetMapping("/sessao/qr")
    public ResponseEntity<byte[]> qr() {
        return file(
                MediaType.IMAGE_PNG,
                ContentDisposition.inline().filename("qr.png").build(),
                service.qr());
    }

    private ResponseEntity<Message> sent(Sent sent) {
        return ResponseEntity.status(sent.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .cacheControl(CacheControl.noStore())
                .body(sent.message());
    }

    private ResponseEntity<byte[]> file(
            MediaType type, ContentDisposition disposition, byte[] bytes) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(type)
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(bytes);
    }

    private <T> ResponseEntity<T> ok(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
