package br.edu.ifgoiano.sager.integrations;

import br.edu.ifgoiano.sager.documents.PrivateFileException;
import br.edu.ifgoiano.sager.documents.PrivateFileStore;
import br.edu.ifgoiano.sager.documents.StoredFile;
import br.edu.ifgoiano.sager.integrations.IntegrationTransactions.Task;
import br.edu.ifgoiano.sager.integrations.SignatureProvider.VerifiedSignature;
import br.edu.ifgoiano.sager.operations.longexits.LongExitRepository;

import org.apache.pdfbox.Loader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.UUID;

@Component
@Profile({ "local", "production" })
public class IntegrationWorker {
    private static final Logger LOG = LoggerFactory.getLogger(IntegrationWorker.class);
    private final IntegrationTransactions transactions;
    private final LongExitRepository exits;
    private final SignatureProvider signatures;
    private final WhatsAppProvider whatsapp;
    private final PrivateFileStore files;
    private final boolean enabled;

    public IntegrationWorker(
            IntegrationTransactions transactions,
            LongExitRepository exits,
            SignatureProvider signatures,
            WhatsAppProvider whatsapp,
            PrivateFileStore files,
            @Value("${sager.integrations.worker.enabled:true}") boolean enabled) {
        this.transactions = transactions;
        this.exits = exits;
        this.signatures = signatures;
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
                    "integration_worker_failure exceptionType={}",
                    failure.getClass().getSimpleName());
        }
    }

    public void runOnce() {
        for (int i = 0; i < 100 && transactions.consumeInbox(); i++) {
            /* bounded inbox batch */
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
                switch (task.type()) {
                    case "PROVISION" -> provision(task);
                    case "WHATSAPP" -> {
                        String token = CapabilityTokens.issue();
                        var send = transactions.beginSend(task, token);
                        if (send == null) continue;
                        messageAttempt = send.attemptId();
                        String messageId = whatsapp.send(send.recipient(), token);
                        transactions.sent(task, messageAttempt, messageId);
                    }
                    case "RECONCILE" -> reconcile(task);
                    case "CANCEL" -> {
                        var binding = transactions.begin(task);
                        if (binding == null) continue;
                        signatures.cancel(binding);
                        transactions.complete(task);
                    }
                    default ->
                            throw new ProviderFailure(
                                    ProviderFailure.Kind.PERMANENT, "invalid_task_type");
                }
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

    private void provision(Task task) {
        for (int step = 0; step < 6; step++) {
            var binding = transactions.begin(task);
            if (binding == null) return;
            var document = exits.document(binding.documentVersionId());
            byte[] original = files.openVerified(document.original());
            UUID result = signatures.prepare(binding.stage(), binding, document, original);
            if (!transactions.provisioned(task, binding.stage(), result, whatsapp.available()))
                return;
        }
    }

    private void reconcile(Task task) {
        var binding = transactions.begin(task);
        if (binding == null) return;
        var document = exits.document(binding.documentVersionId());
        files.openVerified(document.original());
        VerifiedSignature evidence = signatures.inspect(binding);
        if (evidence == null) {
            transactions.complete(task);
            return;
        }
        if (!document.original().sha256().equals(evidence.originalHash()))
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "original_hash_mismatch");
        try (var pdf = Loader.loadPDF(evidence.signedPdf())) {
            if (pdf.getNumberOfPages() < 1)
                throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "signed_pdf_invalid");
        } catch (IOException malformed) {
            throw new ProviderFailure(ProviderFailure.Kind.PERMANENT, "signed_pdf_invalid");
        }
        StoredFile stored =
                files.storeImmutable(
                        UUID.randomUUID(), new ByteArrayInputStream(evidence.signedPdf()));
        transactions.verified(task, evidence, stored);
    }
}
