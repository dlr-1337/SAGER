package br.edu.ifgoiano.sager.auth;

import java.util.Arrays;
import org.springframework.boot.ApplicationArguments;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration
@Profile("migration")
public class MigrationModeGuard {
    @Bean
    static BeanFactoryPostProcessor validateBeforeDatabaseInitialization(Environment environment) {
        return factory -> requireMigration(environment, factory.getBean(ApplicationArguments.class));
    }

    static void requireMigration(Environment environment, ApplicationArguments arguments) {
        if (!Arrays.equals(environment.getActiveProfiles(), new String[] { "migration" })
                || !arguments.containsOption("sager-migrate")
                || !arguments.getOptionValues("sager-migrate").isEmpty()
                || arguments.containsOption("sager-account")
                || !"sager_owner".equals(environment.getProperty("spring.datasource.username"))
                || environment.getProperty("spring.datasource.password", "").length() < 32)
            throw new IllegalStateException("Migration requires its dedicated profile, owner credential and flag.");
    }
}
