package br.edu.ifgoiano.sager.operations.longexits;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
@ConditionalOnProperty(
        name = "sager.operations.expiry.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class LongExitExpiryScheduler {
    private static final Logger LOG = LoggerFactory.getLogger(LongExitExpiryScheduler.class);
    private final LongExitExpiryService expiry;

    public LongExitExpiryScheduler(LongExitExpiryService expiry) {
        this.expiry = expiry;
    }

    @Scheduled(fixedDelayString = "${sager.operations.expiry.interval-ms:60000}")
    public void expire() {
        try {
            expiry.expireDue();
        } catch (RuntimeException failure) {
            LOG.error(
                    "long_exit_expiry_failure exceptionType={}",
                    failure.getClass().getSimpleName());
        }
    }
}
