package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.env.MockEnvironment;

class MigrationModeGuardTest {
    private MockEnvironment valid() {
        var environment = new MockEnvironment().withProperty("spring.datasource.username", "sager_owner")
                .withProperty("spring.datasource.password", "Synthetic_owner_password_20260930_123");
        environment.setActiveProfiles("migration");
        return environment;
    }
    @Test
    void acceptsOneBareFlagAndRejectsMissingValueFlagsOrAccountCommands() {
        assertThatCode(() -> MigrationModeGuard.requireMigration(valid(),
                new DefaultApplicationArguments("--sager-migrate"))).doesNotThrowAnyException();
        for (String[] arguments : new String[][] { {}, { "--sager-migrate=true" },
                { "--sager-migrate", "--sager-account=create" } }) {
            assertThatThrownBy(() -> MigrationModeGuard.requireMigration(valid(),
                    new DefaultApplicationArguments(arguments))).isInstanceOf(IllegalStateException.class);
        }
    }
    @Test
    void refusesWeakOwnerCredentialBeforeAnyDataSourceIsCreated() {
        AtomicBoolean dataSourceCreated = new AtomicBoolean();
        try (var context = new AnnotationConfigApplicationContext()) {
            var environment = valid().withProperty("spring.datasource.password", "weak");
            context.setEnvironment(environment);
            context.getBeanFactory().registerSingleton("springApplicationArguments", new DefaultApplicationArguments("--sager-migrate"));
            context.register(MigrationModeGuard.class);
            context.registerBean("dataSource", Object.class, () -> { dataSourceCreated.set(true); return new Object(); });
            assertThatThrownBy(context::refresh).hasMessageContaining("Migration requires");
            assertThat(dataSourceCreated).isFalse();
        }
    }
}
