package br.edu.ifgoiano.sager.management;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Mesmos exemplos de frontend/src/app/shared/field-rules.spec.ts. */
class FieldRulesTest {
    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("America/Sao_Paulo"));

    @ParameterizedTest
    @ValueSource(strings = { "Ana Li", "Jó Sá", "Maria do Ó", "Ana D'Ávila", "Ana D\u2019Ávila", "Ana-Clara dos Santos",
            "João da Silva Filho", "João Silva Jr", "  ana   li  ", "MARIA DA SILVA" })
    void acceptsRealNames(String name) {
        assertThat(FieldRules.validName(FieldRules.normalizeName(name))).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = { "Maria", "Maria de", "Da Silva", "DA SILVA", "Maria S", "Ana2 Silva", "J. Silva",
            "João Silva Jr.", "Maria e", "de da", "" })
    void refusesOtherNames(String name) {
        assertThat(FieldRules.validName(FieldRules.normalizeName(name))).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = { "20171ABCD000123", "2017.1-abcd/000 123", "2024100000000001", "20151000000000001" })
    void acceptsResidentEnrollments(String enrollment) {
        assertThat(FieldRules.validResidentEnrollment(FieldRules.normalizeEnrollment(enrollment))).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = { "123", "SAGER-QA-2026-001", "TESTE-RESIDENTE", "DEMO-A", "20171ABCD00012",
            "202610000000000001", "19991000000000000" })
    void refusesOtherResidentEnrollments(String enrollment) {
        assertThat(FieldRules.validResidentEnrollment(FieldRules.normalizeEnrollment(enrollment))).isFalse();
    }

    @Test
    void refusesEnrollmentFromAFutureYear() {
        assertThat(FieldRules.validResidentEnrollment(TODAY.getYear() + "1ABCD000123")).isTrue();
        assertThat(FieldRules.validResidentEnrollment((TODAY.getYear() + 1) + "1ABCD000123")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = { "0123456", "DEMO-SUP-001", "abcd", "AAAAAAAAAAAAAAAAAAAA" })
    void acceptsSupervisorIds(String id) {
        assertThat(FieldRules.validSupervisorId(id)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = { "abc", "AAAAAAAAAAAAAAAAAAAAA", "ana@ifgoiano", "SIAPE 123" })
    void refusesOtherSupervisorIds(String id) {
        assertThat(FieldRules.validSupervisorId(id)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = { "maria.silva@estudante.ifgoiano.edu.br", "ana.clara.dias2@estudante.ifgoiano.edu.br", "a@estudante.ifgoiano.edu.br" })
    void acceptsResidentEmails(String email) {
        assertThat(FieldRules.validResidentEmail(email)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = { "maria@gmail.com", "maria@ifgoiano.edu.br", "maria..silva@estudante.ifgoiano.edu.br", "@estudante.ifgoiano.edu.br" })
    void refusesOtherResidentEmails(String email) {
        assertThat(FieldRules.validResidentEmail(email)).isFalse();
    }

    @Test
    void birthDateMustGiveAnAgeFromTenToAHundred() {
        assertThat(FieldRules.plausibleBirthDate(TODAY.minusYears(10))).isTrue();
        assertThat(FieldRules.plausibleBirthDate(TODAY.minusYears(10).plusDays(1))).isFalse();
        assertThat(FieldRules.plausibleBirthDate(TODAY.minusYears(100))).isTrue();
        assertThat(FieldRules.plausibleBirthDate(TODAY.minusYears(101))).isFalse();
        assertThat(FieldRules.plausibleBirthDate(TODAY)).isFalse();
        assertThat(FieldRules.plausibleBirthDate(TODAY.plusDays(1))).isFalse();
        assertThat(FieldRules.plausibleBirthDate(LocalDate.of(1900, 1, 1))).isFalse();
    }

    @Test
    void minorUsesTheCivilDateInSaoPaulo() {
        Instant at = Instant.parse("2026-10-01T01:00:00Z");
        assertThat(FieldRules.minor(LocalDate.of(2008, 10, 1), at)).isTrue();
        assertThat(FieldRules.minor(LocalDate.of(2008, 9, 30), at)).isFalse();
        assertThat(FieldRules.minor(null, at)).isFalse();
        assertThat(FieldRules.minor(LocalDate.of(2026, 10, 1), at)).isFalse();
    }

    @Test
    void capacityAndRelationship() {
        assertThat(FieldRules.validCapacity(1)).isTrue();
        assertThat(FieldRules.validCapacity(20)).isTrue();
        assertThat(FieldRules.validCapacity(0)).isFalse();
        assertThat(FieldRules.validCapacity(21)).isFalse();
        assertThat(FieldRules.hasLetter("Mãe")).isTrue();
        assertThat(FieldRules.hasLetter("12")).isFalse();
    }
}
