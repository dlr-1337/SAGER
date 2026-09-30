package br.edu.ifgoiano.sager;

import java.util.Arrays;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SimpleCommandLinePropertySource;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class SagerApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        boolean accountCommand = Arrays.stream(args).anyMatch(arg -> arg.equals("--sager-account") || arg.startsWith("--sager-account="));
        boolean migrationCommand = Arrays.stream(args).anyMatch(arg -> arg.equals("--sager-migrate") || arg.startsWith("--sager-migrate="));
        if (accountCommand && migrationCommand) {
            System.err.println("Execute comandos de conta e migração separadamente.");
            System.exit(2);
            return;
        }
        if (accountCommand || migrationCommand) {
            StandardEnvironment environment = new StandardEnvironment();
            environment.getPropertySources().addFirst(new SimpleCommandLinePropertySource(args));
            if (!commandProfileAllowed(environment, migrationCommand)) {
                System.err.println(migrationCommand
                        ? "Comando de migração recusado: defina explicitamente somente o perfil 'migration'."
                        : "Comando de contas recusado: defina explicitamente somente o perfil 'local' ou 'production'.");
                System.exit(2);
                return;
            }
        }
        if (migrationCommand) {
            application.setWebApplicationType(WebApplicationType.NONE);
            try (ConfigurableApplicationContext context = application.run(args)) {
                if (!Arrays.equals(context.getEnvironment().getActiveProfiles(), new String[] { "migration" })) {
                    System.err.println("Comando de migração recusado: exige somente o perfil 'migration'.");
                    System.exit(2);
                }
            }
            return;
        }
        if (accountCommand) {
            application.setWebApplicationType(WebApplicationType.NONE);
            int exitCode;
            try (ConfigurableApplicationContext context = application.run(args)) {
                String[] profiles = context.getEnvironment().getActiveProfiles();
                if (profiles.length != 1 || !java.util.Set.of("local", "production").contains(profiles[0])) {
                    System.err.println("Comando de contas recusado: exige somente o perfil 'local' ou 'production'.");
                    exitCode = SpringApplication.exit(context, () -> 2);
                } else {
                    exitCode = SpringApplication.exit(context);
                }
            }
            if (exitCode != 0) {
                System.exit(exitCode);
            }
            return;
        }
        application.run(args);
    }

    static boolean commandProfileAllowed(Environment environment, boolean migration) {
        String configured;
        try {
            configured = environment.getProperty("spring.profiles.active", "");
        } catch (IllegalArgumentException unresolvedConfiguration) {
            return false;
        }
        String[] profiles = Arrays.stream(configured.split(",", -1)).map(String::trim).toArray(String[]::new);
        return profiles.length == 1 && (migration ? profiles[0].equals("migration")
                : java.util.Set.of("local", "production").contains(profiles[0]));
    }
}
