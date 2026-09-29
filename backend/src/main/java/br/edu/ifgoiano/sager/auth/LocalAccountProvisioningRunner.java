package br.edu.ifgoiano.sager.auth;

import java.io.Console;
import java.util.Arrays;
import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
public class LocalAccountProvisioningRunner implements ApplicationRunner {
    private final LocalAccountProvisioningService accounts;
    private final Environment environment;

    public LocalAccountProvisioningRunner(LocalAccountProvisioningService accounts,
            Environment environment) {
        this.accounts = accounts;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        if (!arguments.containsOption("sager-account")) {
            return;
        }
        if (!Arrays.equals(environment.getActiveProfiles(), new String[] { "local" })) {
            throw new IllegalStateException("O comando de contas exige somente o perfil 'local'.");
        }
        String action = requiredOption(arguments, "sager-account");
        String email = requiredOption(arguments, "email");
        switch (action) {
            case "create" -> {
                String name = requiredOption(arguments, "name");
                String profile = requiredOption(arguments, "profile");
                char[] password = readConfirmedPassword();
                try {
                    accounts.create(email, name, profile, password);
                } finally {
                    Arrays.fill(password, '\0');
                }
                System.out.println("Conta local criada.");
            }
            case "reset" -> {
                char[] password = readConfirmedPassword();
                try {
                    accounts.resetPassword(email, password);
                } finally {
                    Arrays.fill(password, '\0');
                }
                System.out.println("Senha local redefinida.");
            }
            case "disable" -> {
                accounts.disable(email);
                System.out.println("Conta local desativada.");
            }
            default -> throw new IllegalArgumentException(
                    "sager-account deve ser create, reset ou disable.");
        }
    }

    private static String requiredOption(ApplicationArguments arguments, String name) {
        List<String> values = arguments.getOptionValues(name);
        if (values == null || values.size() != 1 || values.getFirst() == null
                || values.getFirst().isBlank()) {
            throw new IllegalArgumentException("Opcao obrigatoria: --" + name + "=...");
        }
        return values.getFirst();
    }

    private static char[] readConfirmedPassword() {
        Console console = System.console();
        if (console == null) {
            throw new IllegalStateException("Abra o comando em um terminal interativo para informar a senha.");
        }
        char[] first = console.readPassword("Senha local: ");
        char[] second = console.readPassword("Confirme a senha: ");
        if (first == null || second == null) {
            if (first != null) {
                Arrays.fill(first, '\0');
            }
            if (second != null) {
                Arrays.fill(second, '\0');
            }
            throw new IllegalStateException("Leitura da senha cancelada.");
        }
        try {
            if (!Arrays.equals(first, second)) {
                Arrays.fill(first, '\0');
                throw new IllegalArgumentException("As senhas nao coincidem.");
            }
            return first;
        } finally {
            Arrays.fill(second, '\0');
        }
    }
}
