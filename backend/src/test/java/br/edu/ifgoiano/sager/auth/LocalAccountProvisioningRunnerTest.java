package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.ExitCodeGenerator;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.env.MockEnvironment;

@ExtendWith(OutputCaptureExtension.class)
class LocalAccountProvisioningRunnerTest {
    private final LocalAccountProvisioningService accounts = mock(LocalAccountProvisioningService.class);
    private final MockEnvironment environment = new MockEnvironment();
    private final LocalAccountProvisioningRunner runner = new LocalAccountProvisioningRunner(
            accounts, environment);

    LocalAccountProvisioningRunnerTest() {
        environment.setActiveProfiles("local");
    }

    @Test
    void usesTheExplicitAccountUuidWithoutInterpretingItAsEnrollment() {
        var id=java.util.UUID.randomUUID();
        runner.run(new DefaultApplicationArguments("--sager-account=disable", "--account-id="+id));
        verify(accounts).disable(id);
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
    void rejectsIncompleteCommandsWithoutAStackTrace(CapturedOutput output) {
        assertThatCode(() -> runner.run(new DefaultApplicationArguments(
                "--sager-account=disable"))).doesNotThrowAnyException();
        assertThat(runner).isInstanceOf(ExitCodeGenerator.class);
        assertThat(((ExitCodeGenerator) runner).getExitCode()).isEqualTo(2);
        assertThat(output.getErr()).contains("--email").doesNotContain("Exception", "\tat ");
        verifyNoInteractions(accounts);
    }

    @Test
    void refusesMixedProfilesBeforeChangingAccounts() {
        environment.setActiveProfiles("local", "production");
        assertThatCode(() -> runner.run(new DefaultApplicationArguments(
                "--sager-account=disable", "--email=conta@example.invalid")))
                .doesNotThrowAnyException();
        assertThat(runner).isInstanceOf(ExitCodeGenerator.class);
        assertThat(((ExitCodeGenerator) runner).getExitCode()).isEqualTo(2);
        verifyNoInteractions(accounts);
    }

    @Test
    void explainsExplicitLinkCommandsWithoutChangingAccountsOrReadingAPassword(CapturedOutput output) {
        assertThatCode(() -> runner.run(new DefaultApplicationArguments("--sager-account=help")))
                .doesNotThrowAnyException();
        assertThat(output.getOut()).contains("link-resident", "--resident-id", "link-supervisor",
                "--supervisor-id", "unlink", "--record-id");
        verifyNoInteractions(accounts);
    }
}
