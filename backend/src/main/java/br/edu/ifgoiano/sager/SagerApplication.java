package br.edu.ifgoiano.sager;

import java.util.Arrays;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class SagerApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(SagerApplication.class);
        if (Arrays.stream(args).anyMatch(arg -> arg.startsWith("--sager-account"))) {
            application.setWebApplicationType(WebApplicationType.NONE);
            int exitCode;
            try (ConfigurableApplicationContext context = application.run(args)) {
                if (!Arrays.equals(context.getEnvironment().getActiveProfiles(),
                        new String[] { "local" })) {
                    System.err.println("Comando de contas recusado: exige somente o perfil 'local'.");
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
}
