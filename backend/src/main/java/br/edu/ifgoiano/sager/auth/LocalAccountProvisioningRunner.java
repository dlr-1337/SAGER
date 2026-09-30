package br.edu.ifgoiano.sager.auth;

import java.io.Console;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ExitCodeGenerator;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile({ "local", "production" })
public class LocalAccountProvisioningRunner implements ApplicationRunner, ExitCodeGenerator {
    private static final Set<String> ACTIONS = Set.of("create", "reset", "disable", "link-resident",
            "link-supervisor", "unlink", "help");

    private final LocalAccountProvisioningService accounts;
    private final Environment environment;
    private int exitCode;

    public LocalAccountProvisioningRunner(LocalAccountProvisioningService accounts,
            Environment environment) {
        this.accounts = accounts;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        exitCode = 0;
        if (!arguments.containsOption("sager-account")) {
            return;
        }
        try {
            executeCommand(arguments);
        } catch (IllegalArgumentException | IllegalStateException error) {
            exitCode = 2;
            System.err.println("Comando de contas recusado: " + error.getMessage());
        }
    }

    @Override
    public int getExitCode() {
        return exitCode;
    }

    private void executeCommand(ApplicationArguments arguments) {
        String[] profiles = environment.getActiveProfiles();
        if (profiles.length != 1 || !Set.of("local", "production").contains(profiles[0])) {
            throw new IllegalStateException("O comando de contas exige somente o perfil 'local' ou 'production'.");
        }
        String action = requiredOption(arguments, "sager-account");
        if (!ACTIONS.contains(action)) {
            throw new IllegalArgumentException(
                    "sager-account deve ser create, reset, disable, link-resident, link-supervisor, unlink ou help.");
        }
        if (action.equals("help")) {
            printHelp();
            return;
        }
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
            case "link-resident" -> {
                accounts.linkResident(email, requiredUuid(arguments, "resident-id"));
                System.out.println("Conta local vinculada ao residente.");
            }
            case "link-supervisor" -> {
                accounts.linkSupervisor(email, requiredUuid(arguments, "supervisor-id"));
                System.out.println("Conta local vinculada ao supervisor.");
            }
            case "unlink" -> {
                accounts.unlink(email, requiredUuid(arguments, "record-id"));
                System.out.println("Vinculo da conta local removido.");
            }
            default -> throw new IllegalArgumentException("Comando de contas invalido.");
        }
    }

    private static UUID requiredUuid(ApplicationArguments arguments, String name) {
        String value = requiredOption(arguments, name).trim();
        try {
            UUID id = UUID.fromString(value);
            if (!id.toString().equalsIgnoreCase(value)) {
                throw new IllegalArgumentException();
            }
            return id;
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("Opcao --" + name + " exige um UUID completo valido.");
        }
    }

    private static void printHelp() {
        System.out.println("""
                Comandos administrativos de contas (somente perfil local ou production):
                  --sager-account=create --email=... --name=... --profile=gestor|supervisor|residente|saude
                  --sager-account=reset --email=...
                  --sager-account=disable --email=...
                  --sager-account=link-resident --email=... --resident-id=UUID
                  --sager-account=link-supervisor --email=... --supervisor-id=UUID
                  --sager-account=unlink --email=... --record-id=UUID
                  --sager-account=help
                Create e reset solicitam a senha no terminal; nao use senha em argumentos.
                Vínculos exigem conta ativa e registro existente. Nao criam credenciais nem alteram perfil.
                Residente exige perfil residente; supervisor admite perfil gestor ou supervisor.
                Perfil saude nao concede habilitacao assistencial nem vinculo a residente/supervisor.
                Unlink exige o UUID do vinculo atual e admite conta inativa sem reativa-la.
                Alterar ou remover um vinculo encerra as sessoes existentes da conta.
                """);
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
