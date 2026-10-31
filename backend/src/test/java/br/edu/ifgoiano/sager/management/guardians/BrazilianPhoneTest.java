package br.edu.ifgoiano.sager.management.guardians;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BrazilianPhoneTest {
    @Test
    void acceptsMasksWithOrWithoutCountryCode() {
        assertThat(BrazilianPhone.canonical("(62) 91234-5678")).isEqualTo("+5562912345678");
        assertThat(BrazilianPhone.canonical("62912345678")).isEqualTo("+5562912345678");
        assertThat(BrazilianPhone.canonical("55 62 91234-5678")).isEqualTo("+5562912345678");
        assertThat(BrazilianPhone.canonical("+55 (62) 3201-0000")).isEqualTo("+556232010000");
        assertThat(BrazilianPhone.canonical("(00) 00000-0000")).isNull();
        assertThat(BrazilianPhone.canonical("123")).isNull();
    }

    @Test
    void ninthDigitVariantsMatchOnlyMobileNumbers() {
        assertThat(BrazilianPhone.same("+556212345678", "+5562912345678")).isTrue();
        assertThat(BrazilianPhone.same("+556292345678", "+5562992345678")).isTrue();
        assertThat(BrazilianPhone.same("+5562912345678", "+5562912345679")).isFalse();
        assertThat(BrazilianPhone.same("+556232010000", "+5562932010000")).isFalse();
        assertThat(BrazilianPhone.same(null, "+5562912345678")).isFalse();
        assertThat(BrazilianPhone.variants("+5562992345678"))
                .containsExactlyInAnyOrder("+5562992345678", "+556292345678");
    }
}
