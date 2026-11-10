package br.edu.ifgoiano.sager.conversations;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.Cursor;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.GuardianLink;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.Message;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.OpenExit;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.Preview;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.Replay;
import br.edu.ifgoiano.sager.conversations.ConversationRepository.Summary;
import br.edu.ifgoiano.sager.documents.PrivateFileException;
import br.edu.ifgoiano.sager.documents.PrivateFileStore;
import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.integrations.AuthorizationFileType;
import br.edu.ifgoiano.sager.integrations.ConversationFileType;
import br.edu.ifgoiano.sager.integrations.IntegrationProperties;
import br.edu.ifgoiano.sager.integrations.ProviderFailure;
import br.edu.ifgoiano.sager.integrations.WebhookEventParser;
import br.edu.ifgoiano.sager.integrations.WhatsAppGateway;
import br.edu.ifgoiano.sager.management.guardians.BrazilianPhone;
import br.edu.ifgoiano.sager.operations.OpsActor;
import br.edu.ifgoiano.sager.operations.OpsApiException;
import br.edu.ifgoiano.sager.operations.OpsInput;
import br.edu.ifgoiano.sager.operations.longexits.LongExit;
import br.edu.ifgoiano.sager.operations.longexits.LongExitService;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Every entry re-checks the supervisor, so a route opened by mistake still exposes nothing. */
@Service
@Profile({ "local", "production" })
public class ConversationService {
    private static final int MAX_FILE_BYTES = 10485760;
    static final int MAX_TEXT = 4096;
    private static final int MAX_CAPTION = 1024;
    // The gateway has no reliable path for HEIC; it can be received but not sent.
    private static final Set<String> SENDABLE =
            Set.of(
                    "application/pdf",
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "audio/ogg",
                    "audio/mpeg",
                    "audio/webm",
                    "audio/mp4");
    private final ConversationRepository repository;
    private final ConversationTransactions transactions;
    private final WhatsAppGateway whatsapp;
    private final IntegrationProperties properties;
    private final PrivateFileStore files;
    private final LongExitService exits;
    private final OpsActor actors;
    private final Clock clock;

    public ConversationService(
            ConversationRepository repository,
            ConversationTransactions transactions,
            WhatsAppGateway whatsapp,
            IntegrationProperties properties,
            PrivateFileStore files,
            LongExitService exits,
            OpsActor actors,
            Clock clock) {
        this.repository = repository;
        this.transactions = transactions;
        this.whatsapp = whatsapp;
        this.properties = properties;
        this.files = files;
        this.exits = exits;
        this.actors = actors;
        this.clock = clock;
    }

    public Page<Conversation> list(String q, String before, int limit) {
        actors.supervisor();
        String term = q == null || q.isBlank() ? null : storable(q.trim());
        if (term != null && term.length() > 100) throw OpsInput.invalid("Busca muito longa.");
        List<Summary> found = repository.list(term, cursor(before), checked(limit) + 1);
        boolean more = found.size() > limit;
        List<Summary> page = more ? found.subList(0, limit) : found;
        List<GuardianLink> guardians =
                repository.guardians(
                        page.stream().map(Summary::phone).filter(Objects::nonNull).toList());
        return new Page<>(
                page.stream().map(s -> view(s, guardians)).toList(),
                more
                        ? page.getLast().lastMessageAt() + "~" + page.getLast().id()
                        : null);
    }

    public Conversation read(UUID id) {
        actors.supervisor();
        return view(required(id));
    }

    public Page<Message> history(UUID id, String before, int limit) {
        actors.supervisor();
        required(id);
        List<Message> found = repository.messages(id, cursor(before), checked(limit) + 1);
        boolean more = found.size() > limit;
        List<Message> page = new ArrayList<>(more ? found.subList(0, limit) : found);
        String next = more ? page.getLast().sentAt() + "~" + page.getLast().id() : null;
        Collections.reverse(page);
        return new Page<>(page, next);
    }

    public void markRead(UUID id) {
        actors.supervisor();
        required(id);
        repository.markRead(id, now());
    }

    public Media media(UUID messageId) {
        actors.supervisor();
        var stored = repository.media(messageId).orElseThrow(OpsInput::notFound);
        return new Media(
                files.openVerified(stored.file()), stored.mediaType(), stored.filename());
    }

    public Sent sendText(UUID conversation, String key, String text) {
        var actor = actors.supervisor();
        Summary target = required(conversation);
        String idempotency = key(key);
        storable(text);
        Replay replay = repository.replay(actor.id(), idempotency, conversation, text, null);
        if (replay != null) return replayed(replay);
        requireReady();
        UUID created =
                transactions.enqueue(target, actor.id(), idempotency, text, null, null, null);
        return created != null ? new Sent(message(created), true) : raced(actor.id(), idempotency, conversation, text, null);
    }

    public Sent sendFile(
            UUID conversation,
            String key,
            String text,
            byte[] bytes,
            String declaredType,
            String originalName) {
        var actor = actors.supervisor();
        Summary target = required(conversation);
        String idempotency = key(key);
        String caption = text == null || text.isBlank() ? null : storable(text.trim());
        if (caption != null && OpsInput.characters(caption) > MAX_CAPTION)
            throw OpsInput.invalid("A legenda pode ter até " + MAX_CAPTION + " caracteres.");
        if (bytes.length == 0 || bytes.length > MAX_FILE_BYTES)
            throw OpsInput.invalid("Envie um arquivo de até 10 MiB.");
        String type = ConversationFileType.detect(bytes, declaredType);
        if (type == null || !SENDABLE.contains(type))
            throw OpsInput.invalid("Envie imagem JPEG, PNG ou WEBP, PDF ou áudio.");
        if (type.startsWith("audio/") && caption != null)
            throw OpsInput.invalid("Áudio não aceita legenda.");
        String hash = sha256(bytes);
        Replay replay = repository.replay(actor.id(), idempotency, conversation, caption, hash);
        if (replay != null) return replayed(replay);
        requireReady();
        StoredFile file;
        try {
            file = files.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(bytes));
        } catch (PrivateFileException failure) {
            throw new OpsApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "document_unavailable",
                    "Não foi possível armazenar o arquivo.");
        }
        UUID created =
                transactions.enqueue(
                        target,
                        actor.id(),
                        idempotency,
                        caption,
                        file,
                        type,
                        type.startsWith("audio/")
                                ? null
                                : ConversationFileType.safeName(originalName, type));
        return created != null ? new Sent(message(created), true) : raced(actor.id(), idempotency, conversation, caption, hash);
    }

    /** Only a registered guardian, and only after the gateway says the number exists. */
    public Started start(UUID guardianId) {
        actors.supervisor();
        if (!whatsapp.available()) throw unavailable("gateway_disabled");
        GuardianLink guardian =
                repository.activeGuardian(guardianId).orElseThrow(OpsInput::notFound);
        String phone = guardian.phone();
        if (phone == null)
            throw new OpsApiException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "phone_missing",
                    "O responsável não tem telefone cadastrado.");
        var existing = repository.byPhones(BrazilianPhone.variants(phone));
        if (existing.isPresent()) return new Started(view(existing.get()), false);
        String chat;
        try {
            chat = whatsapp.resolveRecipient(phone.substring(1));
        } catch (ProviderFailure failure) {
            if ("recipient_not_found".equals(failure.code()))
                throw new OpsApiException(
                        HttpStatus.UNPROCESSABLE_CONTENT,
                        "number_not_found",
                        "Este número não existe no WhatsApp. Nenhuma mensagem foi enviada.");
            throw unavailable(
                    "session_not_ready".equals(failure.code())
                            ? "session_not_ready"
                            : "gateway_unreachable");
        }
        String resolved = WebhookEventParser.phone(chat);
        UUID id =
                transactions.open(
                        properties.whatsappSession(), chat, resolved == null ? phone : resolved);
        return new Started(view(required(id)), true);
    }

    public List<OpenExit> openExits(UUID id) {
        actors.supervisor();
        return repository.openExits(required(id).phone());
    }

    /** Becomes a candidate through the long exit flow: human review and approval still apply. */
    public LongExit link(UUID messageId, UUID exitId, long version) {
        actors.supervisor();
        Message message = message(messageId);
        if (!"IN".equals(message.direction())
                || !"STORED".equals(message.mediaState())
                || !AuthorizationFileType.accepts(message.mediaType()))
            throw OpsInput.invalid("Só uma imagem ou um PDF recebido pode ser vinculado.");
        Summary conversation = required(message.conversationId());
        if (repository.openExits(conversation.phone()).stream()
                .noneMatch(e -> e.id().equals(exitId)))
            throw OpsInput.conflict(
                    "exit_not_open", "A saída não está aberta para o responsável desta conversa.");
        return exits.linkAuthorization(exitId, version, messageId);
    }

    public SessionView session() {
        actors.supervisor();
        return sessionView();
    }

    public SessionView startSession() {
        actors.supervisor();
        if (!whatsapp.available()) throw unavailable("gateway_disabled");
        transactions.auditSession(sessionResource(), AuditAction.UPDATE, "started");
        try {
            whatsapp.startSession();
        } catch (ProviderFailure failure) {
            throw unavailable("gateway_unreachable");
        }
        return sessionView();
    }

    /** Showing the QR hands over the account, so the attempt is audited before it is released. */
    public byte[] qr() {
        actors.supervisor();
        if (!whatsapp.available()) throw unavailable("gateway_disabled");
        transactions.auditSession(sessionResource(), AuditAction.READ, "qrRead");
        try {
            return whatsapp.qr();
        } catch (ProviderFailure failure) {
            if (failure.kind() == ProviderFailure.Kind.PERMANENT)
                throw OpsInput.conflict(
                        "qr_unavailable", "O código só existe enquanto a sessão aguarda leitura.");
            throw unavailable("gateway_unreachable");
        }
    }

    private SessionView sessionView() {
        var stored = repository.session(properties.whatsappSession());
        String status, reason;
        if (!whatsapp.available()) {
            status = "DISABLED";
            reason = "gateway_disabled";
        } else {
            // The live state decides, so a lost session event cannot block sending.
            try {
                status = liveStatus();
                reason = "WORKING".equals(status) ? null : "session_not_ready";
            } catch (ProviderFailure failure) {
                status = stored.map(ConversationRepository.StoredSession::status).orElse("STOPPED");
                reason = "gateway_unreachable";
            }
        }
        return new SessionView(
                whatsapp.available(),
                status,
                stored.map(ConversationRepository.StoredSession::linkedAt).orElse(null),
                stored.map(ConversationRepository.StoredSession::lastEventAt).orElse(null),
                reason == null,
                reason);
    }

    private void requireReady() {
        String reason = sessionView().unavailableReason();
        if (reason != null) throw unavailable(reason);
    }

    private String liveStatus() {
        try {
            return whatsapp.session().status();
        } catch (ProviderFailure failure) {
            if ("provider_not_found".equals(failure.code())) return "STOPPED";
            throw failure;
        }
    }

    private OpsApiException unavailable(String reason) {
        return new OpsApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                reason,
                switch (reason) {
                    case "gateway_disabled" -> "O WhatsApp está desligado neste ambiente.";
                    case "session_not_ready" -> "A sessão do WhatsApp não está conectada.";
                    default -> "O serviço do WhatsApp não respondeu. Tente de novo em instantes.";
                });
    }

    private Sent replayed(Replay replay) {
        if (!replay.same())
            throw OpsInput.conflict(
                    "idempotency_conflict", "Esta chave já foi usada em outro envio.");
        return new Sent(message(replay.messageId()), false);
    }

    private Sent raced(UUID actor, String key, UUID conversation, String body, String hash) {
        return replayed(repository.replay(actor, key, conversation, body, hash));
    }

    private Message message(UUID id) {
        return repository.message(id).orElseThrow(OpsInput::notFound);
    }

    private Summary required(UUID id) {
        return repository.summary(id).orElseThrow(OpsInput::notFound);
    }

    private Conversation view(Summary summary) {
        return view(
                summary,
                summary.phone() == null ? List.of() : repository.guardians(List.of(summary.phone())));
    }

    private Conversation view(Summary s, List<GuardianLink> known) {
        List<GuardianLink> guardians =
                known.stream().filter(g -> BrazilianPhone.same(s.phone(), g.phone())).toList();
        return new Conversation(
                s.id(),
                s.chatId(),
                s.phone(),
                !guardians.isEmpty(),
                guardians,
                s.lastMessage(),
                s.unreadCount(),
                s.lastMessageAt());
    }

    private static Cursor cursor(String value) {
        if (value == null || value.isBlank()) return null;
        int split = value.indexOf('~');
        try {
            return new Cursor(
                    Instant.parse(value.substring(0, split)),
                    UUID.fromString(value.substring(split + 1)));
        } catch (DateTimeParseException | IllegalArgumentException | IndexOutOfBoundsException e) {
            throw OpsInput.invalid("Cursor inválido.");
        }
    }

    /** PostgreSQL text cannot hold NUL; refused here instead of failing as a server error. */
    private static String storable(String text) {
        if (text.indexOf('\0') >= 0) throw OpsInput.invalid("O texto contém caractere inválido.");
        return text;
    }

    private static int checked(int limit) {
        if (limit < 1 || limit > 100) throw OpsInput.invalid("Informe limite entre 1 e 100.");
        return limit;
    }

    private static String key(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{8,128}"))
            throw OpsInput.invalid("Informe Idempotency-Key com 8 a 128 caracteres.");
        return value;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 indisponível.");
        }
    }

    private UUID sessionResource() {
        return UUID.nameUUIDFromBytes(
                ("WHATSAPP_GATEWAY:" + properties.whatsappSession())
                        .getBytes(StandardCharsets.UTF_8));
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    public record Page<T>(List<T> items, String nextCursor) {}

    public record Conversation(
            UUID id,
            String chatId,
            String phone,
            boolean linked,
            List<GuardianLink> guardians,
            Preview lastMessage,
            long unreadCount,
            Instant lastMessageAt) {}

    public record Sent(Message message, boolean created) {}

    public record Started(Conversation conversation, boolean created) {}

    public record Media(byte[] bytes, String mediaType, String filename) {}

    public record SessionView(
            boolean available,
            String status,
            Instant linkedAt,
            Instant lastEventAt,
            boolean canSend,
            String unavailableReason) {}
}
