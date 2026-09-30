package br.edu.ifgoiano.sager.operations.shortexits;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
@ConditionalOnProperty(prefix = "sager.operations.expiry", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ShortExitExpiryScheduler {
    private static final Logger LOG = LoggerFactory.getLogger(ShortExitExpiryScheduler.class);
    private final ShortExitExpiryService expiry;

    public ShortExitExpiryScheduler(ShortExitExpiryService expiry) {
        this.expiry = expiry;
    }

    @Scheduled(initialDelay = 60000, fixedDelay = 60000)
    public void expire() {
        try {
            expiry.expireDue();
        } catch (RuntimeException error) {
            LOG.error("short_exit_expiry_failure exceptionType={}", error.getClass().getSimpleName());
        }
    }
}
