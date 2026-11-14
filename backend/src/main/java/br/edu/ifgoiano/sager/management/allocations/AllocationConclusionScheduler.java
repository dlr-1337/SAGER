package br.edu.ifgoiano.sager.management.allocations;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Libera, uma vez por dia, a vaga de quem passou da saída prevista do curso. */
@Component
@Profile({ "local", "production" })
@ConditionalOnProperty(prefix = "sager.operations.expiry", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AllocationConclusionScheduler {
    private static final Logger LOG = LoggerFactory.getLogger(AllocationConclusionScheduler.class);
    private final AllocationService allocations;

    public AllocationConclusionScheduler(AllocationService allocations) {
        this.allocations = allocations;
    }

    @Scheduled(cron = "0 10 0 * * *", zone = "America/Sao_Paulo")
    public void closeConcluded() {
        try {
            LOG.info("allocation_conclusion_closed count={}", allocations.closeConcluded());
        } catch (RuntimeException error) {
            LOG.error("allocation_conclusion_failure exceptionType={}", error.getClass().getSimpleName());
        }
    }
}
