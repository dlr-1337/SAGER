package br.edu.ifgoiano.sager.management.residents;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ResidentNameFormatTest {
    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "joao silva|Joao Silva",
            "JOAO SILVA|Joao Silva",
            "JOAO silva|Joao Silva",
            "JOÃO ANTÔNIO|João Antônio",
            "ÁGATA ÇÃO|Ágata Ção",
            "MARIA DA SILVA|Maria Da Silva",
            "ANA-MARIA D'ÁVILA|Ana-Maria D'Ávila",
            "ana  maria|Ana  Maria",
    })
    void formatsEveryWordWithoutChangingAccentsOrSpaces(String typed, String expected) {
        assertThat(ResidentService.formatName(typed)).isEqualTo(expected);
        assertThat(ResidentService.formatName(expected)).isEqualTo(expected);
    }
}
