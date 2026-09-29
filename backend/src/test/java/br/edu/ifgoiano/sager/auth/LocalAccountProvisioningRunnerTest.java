package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.mock.env.MockEnvironment;

class LocalAccountProvisioningRunnerTest {
    private final LocalAccountProvisioningService accounts = mock(LocalAccountProvisioningService.class);
    private final MockEnvironment environment = new MockEnvironment();
    private final LocalAccountProvisioningRunner runner = new LocalAccountProvisioningRunner(
            accounts, environment);

    LocalAccountProvisioningRunnerTest() {
        environment.setActiveProfiles("local");
    }

    @Test
    void ignoresRegularServerStartup() {
        runner.run(new DefaultApplicationArguments());
        verifyNoInteractions(accounts);
    }

    @Test
    void dispatchesDisableWithoutReadingAnyPassword() {
        runner.run(new DefaultApplicationArguments("--sager-account=disable",
                "--email=conta@example.invalid"));
        verify(accounts).disable("conta@example.invalid");
    }

    @Test
    void rejectsIncompleteCommands() {
        assertThatThrownBy(() -> runner.run(new DefaultApplicationArguments(
                "--sager-account=disable"))).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(accounts);
    }

    @Test
    void refusesMixedProfilesBeforeChangingAccounts() {
        environment.setActiveProfiles("local", "production");
        assertThatThrownBy(() -> runner.run(new DefaultApplicationArguments(
                "--sager-account=disable", "--email=conta@example.invalid")))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(accounts);
    }
}
