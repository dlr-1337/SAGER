package br.edu.ifgoiano.sager;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class SagerApplicationCommandProfileTest {
    @Test
    void rejectsWrongOrImplicitProfilesBeforeApplicationStartup() {
        for (String profile : new String[] { "", "local", "production", "migration,local", "migration,", "${PROFILE}" }) {
            assertThat(SagerApplication.commandProfileAllowed(
                    new MockEnvironment().withProperty("spring.profiles.active", profile), true)).isFalse();
        }
        assertThat(SagerApplication.commandProfileAllowed(new MockEnvironment(), true)).isFalse();
        assertThat(SagerApplication.commandProfileAllowed(
                new MockEnvironment().withProperty("spring.profiles.active", "migration"), true)).isTrue();
    }

    @Test
    void allowsExplicitAccountProfilesAndRejectsMigrationOrCombinedProfiles() {
        for (String profile : new String[] { "local", "production" }) {
            assertThat(SagerApplication.commandProfileAllowed(
                    new MockEnvironment().withProperty("spring.profiles.active", profile), false)).isTrue();
        }
        for (String profile : new String[] { "", "migration", "production,local", "local,", "closed" }) {
            assertThat(SagerApplication.commandProfileAllowed(
                    new MockEnvironment().withProperty("spring.profiles.active", profile), false)).isFalse();
        }
    }
}
