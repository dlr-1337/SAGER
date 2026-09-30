package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

import br.edu.ifgoiano.sager.SagerApplication;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class AccountCommandApplicationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17.11");

    static {
        POSTGRES.start();
    }

    @TempDir
    private Path temporaryDirectory;

    @ParameterizedTest
    @ValueSource(strings = { "help", "disable" })
    void rejectsAccountCommandsOutsideLocalWithExitTwoAndNoStackTrace(String command) throws Exception {
        Path output = temporaryDirectory.resolve("command-output.log");
        String javaExecutable = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        ProcessBuilder builder = new ProcessBuilder(javaExecutable, "-cp",
                System.getProperty("surefire.test.class.path"), SagerApplication.class.getName(),
                "--spring.profiles.active=not-local", "--sager-account=" + command,
                "--email=synthetic@example.invalid", "--spring.main.banner-mode=off",
                "--logging.level.root=WARN");
        builder.environment().put("SAGER_DB_URL", POSTGRES.getJdbcUrl());
        builder.environment().put("SAGER_DB_USER", POSTGRES.getUsername());
        builder.environment().put("SAGER_DB_PASSWORD", POSTGRES.getPassword());
        builder.redirectErrorStream(true).redirectOutput(output.toFile());
        Process process = builder.start();
        try {
            assertThat(process.waitFor(45, TimeUnit.SECONDS)).isTrue();
            assertThat(process.exitValue()).isEqualTo(2);
            assertThat(Files.readString(output)).contains("exige somente o perfil 'local'")
                    .doesNotContain("Exception", "\tat ", "Conta local desativada", "Conta local criada");
            JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(),
                    POSTGRES.getUsername(), POSTGRES.getPassword()));
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sager_local_account", Integer.class))
                    .isZero();
        } finally {
            if (process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }
}
