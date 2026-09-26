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
            try (ConfigurableApplicationContext context = application.run(args)) {
                if (!Arrays.equals(context.getEnvironment().getActiveProfiles(),
                        new String[] { "local" })) {
                    throw new IllegalStateException("O comando de contas exige somente o perfil 'local'.");
                }
            }
            return;
        }
        application.run(args);
    }
}
