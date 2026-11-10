package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class LocalAccountPasswordPolicyTest {
    private static final String TOO_EASY = "Essa senha é fácil demais. Escolha outra.";

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final LocalAccountProvisioningService service = new LocalAccountProvisioningService(null, encoder);

    @ParameterizedTest
    @ValueSource(strings = { "gato azul", "gatoazul", "12345679", "abcdefgj" })
    void acceptsSimplePasswordsWithoutCompositionRules(String password) {
        assertThat(encoder.matches(password, service.hashAndClear(password.toCharArray(), "TESTE-1"))).isTrue();
    }

    @Test
    void measuresTheMinimumInCharactersAndTheMaximumInBytes() {
        assertThatThrownBy(() -> service.hashAndClear("gatoazu".toCharArray(), null))
                .hasMessage("A senha precisa ter pelo menos 8 letras ou números.");
        assertThat(service.hashAndClear("gato az1".toCharArray(), null)).isNotBlank();
        assertThat(service.hashAndClear("çã".repeat(18).toCharArray(), null)).isNotBlank();
        assertThatThrownBy(() -> service.hashAndClear(("çã".repeat(18) + "x").toCharArray(), null))
                .hasMessage("Essa senha é longa demais. Use uma mais curta.");
        assertThatThrownBy(() -> service.hashAndClear(null, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = { "12345678", "87654321", "123456789", "1234567890", "0987654321", "abcdefgh", "ABCDEFGH",
            "hgfedcba", "aaaaaaaa", "11111111", "        ", "senha123", "SENHA123", "password", "qwertyui", "ifgoiano",
            "sager123" })
    void refusesObviousPasswords(String password) {
        assertThatThrownBy(() -> service.hashAndClear(password.toCharArray(), "TESTE-1")).hasMessage(TOO_EASY);
    }

    @Test
    void refusesTheOwnEnrollmentIgnoringCase() {
        assertThatThrownBy(() -> service.hashAndClear("teste-abc1".toCharArray(), " TESTE-ABC1 "))
                .hasMessage("A senha não pode ser igual à matrícula.");
    }

    @Test
    void clearsTheSuppliedPasswordEvenWhenRefused() {
        char[] refused = "12345678".toCharArray();
        assertThatThrownBy(() -> service.hashAndClear(refused, null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(refused).containsOnly('\0');
    }
}
