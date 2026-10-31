package br.edu.ifgoiano.sager.conversations;

import br.edu.ifgoiano.sager.conversations.ConversationTransactions.SendJob;
import br.edu.ifgoiano.sager.documents.PrivateFileException;
import br.edu.ifgoiano.sager.documents.PrivateFileStore;
import br.edu.ifgoiano.sager.integrations.ProviderFailure;
import br.edu.ifgoiano.sager.integrations.WhatsAppGateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Sends queued messages. Media downloads stay in the integration worker that already runs them. */
@Component
@Profile({ "local", "production" })
public class ConversationWorker {
    private static final Logger LOG = LoggerFactory.getLogger(ConversationWorker.class);
    private final ConversationTransactions transactions;
    private final WhatsAppGateway whatsapp;
    private final PrivateFileStore files;
    private final boolean enabled;

    public ConversationWorker(
            ConversationTransactions transactions,
            WhatsAppGateway whatsapp,
            PrivateFileStore files,
            @Value("${sager.integrations.worker.enabled:true}") boolean enabled) {
        this.transactions = transactions;
        this.whatsapp = whatsapp;
        this.files = files;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${sager.integrations.worker.interval-ms:5000}")
    public void scheduled() {
        if (!enabled) return;
        try {
            runOnce();
        } catch (RuntimeException failure) {
            LOG.error(
                    "conversation_worker_failure exceptionType={}",
                    failure.getClass().getSimpleName());
        }
    }

    public void runOnce() {
        for (int i = 0; i < 10; i++) {
            SendJob job = transactions.claimSend();
            if (job == null) return;
            try {
                if (job.interrupted())
                    throw new ProviderFailure(
                            ProviderFailure.Kind.UNCERTAIN, "interrupted_external_post");
                transactions.sent(job, send(job));
            } catch (ProviderFailure failure) {
                transactions.sendFailed(job, failure);
            } catch (PrivateFileException failure) {
                transactions.sendFailed(
                        job,
                        new ProviderFailure(ProviderFailure.Kind.PERMANENT, "document_unavailable"));
            }
        }
    }

    private String send(SendJob job) {
        if (job.file() == null) return whatsapp.sendText(job.chatId(), job.body());
        byte[] bytes = files.openVerified(job.file());
        String caption = job.body() == null ? "" : job.body();
        if (job.mediaType().startsWith("audio/"))
            return whatsapp.sendVoice(job.chatId(), job.mediaType(), bytes);
        if (job.mediaType().startsWith("image/"))
            return whatsapp.sendImage(
                    job.chatId(), job.filename(), job.mediaType(), bytes, caption);
        return whatsapp.sendDocument(job.chatId(), job.filename(), bytes, caption);
    }
}
