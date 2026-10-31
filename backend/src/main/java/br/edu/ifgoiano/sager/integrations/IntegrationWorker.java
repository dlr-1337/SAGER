package br.edu.ifgoiano.sager.integrations;

import br.edu.ifgoiano.sager.documents.LongExitPdfGenerator;
import br.edu.ifgoiano.sager.documents.PrivateFileException;
import br.edu.ifgoiano.sager.documents.PrivateFileStore;
import br.edu.ifgoiano.sager.integrations.IntegrationTransactions.Task;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.RecoverableDataAccessException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Component
@Profile({ "local", "production" })
public class IntegrationWorker {
    private static final Logger LOG = LoggerFactory.getLogger(IntegrationWorker.class);
    private static final Duration ACTIVE_CHAT_WINDOW = Duration.ofHours(24);
    private static final int ACTIVE_CHATS_PER_ROUND = 20;
    private final IntegrationTransactions transactions;
    private final IntegrationRepository repository;
    private final WhatsAppInbound inbound;
    private final LongExitRepository exits;
    private final WhatsAppGateway whatsapp;
    private final PrivateFileStore files;
    private final Clock clock;
    private final boolean enabled;

    public IntegrationWorker(
            IntegrationTransactions transactions,
            IntegrationRepository repository,
            WhatsAppInbound inbound,
            LongExitRepository exits,
            WhatsAppGateway whatsapp,
            PrivateFileStore files,
            Clock clock,
            @Value("${sager.integrations.worker.enabled:true}") boolean enabled) {
        this.transactions = transactions;
        this.repository = repository;
        this.inbound = inbound;
        this.exits = exits;
        this.whatsapp = whatsapp;
        this.files = files;
        this.clock = clock;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${sager.integrations.worker.interval-ms:5000}")
    public void scheduled() {
        if (!enabled) return;
        try {
            runOnce();
        } catch (RuntimeException failure) {
            LOG.error(
                    "integration_worker_failure exceptionType={}",
                    failure.getClass().getSimpleName());
        }
    }

    @Scheduled(fixedDelayString = "${sager.integrations.whatsapp.reconcile-interval-ms:120000}")
    public void scheduledReconciliation() {
        if (!enabled || !whatsapp.available()) return;
        try {
            reconcileOnce();
        } catch (RuntimeException failure) {
            LOG.warn(
                    "whatsapp_reconciliation_failure exceptionType={}",
                    failure.getClass().getSimpleName());
        }
    }

    public void runOnce() {
        for (int i = 0; i < 100; i++) {
            UUID event = transactions.nextInbox();
            if (event == null) break;
            try {
                transactions.consumeInbox(event);
            } catch (TransientDataAccessException
                    | RecoverableDataAccessException
                    | DataAccessResourceFailureException unavailable) {
                throw unavailable;
            } catch (RuntimeException invalid) {
                LOG.warn(
                        "integration_inbox_failure exceptionType={}",
                        invalid.getClass().getSimpleName());
                transactions.failInbox(event, "event_processing_failed");
            }
        }
        for (int i = 0; i < 10; i++) {
            WhatsAppInbound.Job job = inbound.claimJob();
            if (job == null) break;
            download(job);
        }
        for (int i = 0; i < 10; i++) {
            Task task = transactions.claim();
            if (task == null) return;
            UUID messageAttempt = null;
            try {
                if (task.exhausted())
                    throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "retry_exhausted");
                if (task.inFlight())
                    throw new ProviderFailure(
                            ProviderFailure.Kind.UNCERTAIN, "interrupted_external_post");
                if (!"WHATSAPP".equals(task.type()))
                    throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "invalid_task_type");
                var send = transactions.beginSend(task);
                if (send == null) continue;
                messageAttempt = send.attemptId();
                var document = exits.document(send.binding().documentVersionId());
                byte[] original = files.openVerified(document.original());
                String code = LongExitPdfGenerator.shortCode(document.id());
                String chat = whatsapp.resolveRecipient(send.recipient());
                String filename = "autorizacao-" + code + "-r" + document.revision() + ".pdf";
                String body = caption(code, document.revision());
                String messageId = whatsapp.sendDocument(chat, filename, original, body);
                transactions.sent(task, messageAttempt, messageId);
                addToConversation(
                        chat, send.binding().guardianPhone(), messageId, body, filename, original);
            } catch (ProviderFailure failure) {
                transactions.fail(task, failure, messageAttempt);
            } catch (PrivateFileException failure) {
                transactions.fail(
                        task,
                        new ProviderFailure(ProviderFailure.Kind.PERMANENT, "document_unavailable"),
                        messageAttempt);
            }
        }
    }

    /** Lost webhooks converge here: the same message key makes this write only what is missing. */
    public void reconcileOnce() {
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        String status = whatsapp.session().status();
        inbound.recordPolledSession(status, now);
        Instant linked = inbound.linkedAt();
        if (linked == null || !"WORKING".equals(status)) return;
        for (String lid : inbound.unresolvedLids()) {
            try {
                String phone = whatsapp.resolveLid(lid);
                if (phone != null) inbound.resolveLid(lid, phone);
            } catch (ProviderFailure failure) {
                LOG.warn("whatsapp_lid_failure code={}", failure.code());
            }
        }
        inbound.mergeLidConversations();
        Set<String> asked = new HashSet<>();
        for (var chat : repository.pendingChats(now)) {
            try {
                String id = whatsapp.resolveRecipient(chat.phone().substring(1));
                asked.add(id);
                recover(id, chat.since().isAfter(linked) ? chat.since() : linked);
            } catch (ProviderFailure failure) {
                LOG.warn("whatsapp_reconciliation_chat_failure code={}", failure.code());
            }
        }
        Instant window = now.minus(ACTIVE_CHAT_WINDOW);
        for (String chat : inbound.activeChats(window, ACTIVE_CHATS_PER_ROUND)) {
            if (!asked.add(chat)) continue;
            try {
                recover(chat, window.isAfter(linked) ? window : linked);
            } catch (ProviderFailure failure) {
                LOG.warn("whatsapp_reconciliation_chat_failure code={}", failure.code());
            }
        }
    }

    private void recover(String chat, Instant since) {
        for (var message : whatsapp.recentMessages(chat, since)) {
            if (inbound.afterLink(message.sentAt())) inbound.record(message, "RECONCILIATION");
        }
    }

    /**
     * The send already happened, so a history that cannot be written only loses this entry. Each
     * message owns its file: a resend of the same revision is another message of the same PDF.
     */
    private void addToConversation(
            String chat, String phone, String messageId, String body, String filename, byte[] pdf) {
        try {
            var file = files.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(pdf));
            inbound.documentSent(chat, phone, messageId, body, filename, file);
        } catch (RuntimeException failure) {
            LOG.warn(
                    "whatsapp_document_history_failure exceptionType={}",
                    failure.getClass().getSimpleName());
        }
    }

    private void download(WhatsAppInbound.Job job) {
        try {
            if (job.exhausted())
                throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "retry_exhausted");
            String sender =
                    job.senderPhone() != null
                            ? job.senderPhone()
                            : job.senderLid() == null ? null : whatsapp.resolveLid(job.senderLid());
            byte[] bytes = whatsapp.downloadMedia(job.mediaPath());
            String type = ConversationFileType.detect(bytes, job.declaredType());
            if (type == null)
                throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "media_type_not_allowed");
            var stored = files.storeImmutable(UUID.randomUUID(), new ByteArrayInputStream(bytes));
            inbound.mediaStored(job, stored, type, sender);
        } catch (ProviderFailure failure) {
            inbound.jobFailed(job, failure);
        } catch (PrivateFileException failure) {
            inbound.jobFailed(
                    job,
                    new ProviderFailure(ProviderFailure.Kind.RETRYABLE, "media_storage_failed"));
        }
    }

    private static String caption(String code, int revision) {
        return "Autorização de saída longa, revisão "
                + revision
                + ", código "
                + code
                + ". Assine e devolva o documento respondendo a esta mensagem. A saída depende da"
                + " análise da equipe da residência.";
    }
}
