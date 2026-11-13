package br.edu.ifgoiano.sager.management.residents;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class CourseProgressTest {
    private static final LocalDate TODAY = LocalDate.of(2020, 1, 1);

    @Test
    void expectedExitUsesEntrySemesterDurationAndExtension() {
        assertThat(exit("20221ABCD000123", 2022, 0)).isEqualTo(LocalDate.of(2025, 12, 31));
        assertThat(exit("20222ABCD000123", 2022, 0)).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(exit("20220ABCD000123", 2022, 0)).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(exit("SAGER", 2022, 0)).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(exit("20221ABCD000123", 2022, 1)).isEqualTo(LocalDate.of(2026, 6, 30));
    }

    @Test
    void missingYearOrDurationGivesNothing() {
        CourseProgress empty = new CourseProgress(null, null, false);
        assertThat(CourseProgress.of("20221ABCD000123", null, 0, "SUPERIOR", 4, TODAY)).isEqualTo(empty);
        assertThat(CourseProgress.of("20221ABCD000123", 2022, 0, "SUPERIOR", null, TODAY)).isEqualTo(empty);
    }

    @Test
    void concludesOnlyAfterTheExpectedExit() {
        CourseProgress last = CourseProgress.of("20222ABCD000123", 2022, 0, "SUPERIOR", 4, LocalDate.of(2026, 6, 30));
        assertThat(last).isEqualTo(new CourseProgress("8º período", LocalDate.of(2026, 6, 30), false));
        CourseProgress after = CourseProgress.of("20222ABCD000123", 2022, 0, null, 4, LocalDate.of(2026, 7, 1));
        assertThat(after).isEqualTo(new CourseProgress("Concluinte", LocalDate.of(2026, 6, 30), true));
    }

    @Test
    void stageFollowsTheLevel() {
        LocalDate august = LocalDate.of(2026, 8, 10);
        assertThat(CourseProgress.of("20251ABCD000123", 2025, 0, "SUPERIOR", 4, august).stage()).isEqualTo("4º período");
        assertThat(CourseProgress.of("20251ABCD000123", 2025, 0, "MEDIO", 3, august).stage()).isEqualTo("2º ano");
        assertThat(CourseProgress.of("20271ABCD000123", 2027, 0, "SUPERIOR", 4, LocalDate.of(2026, 11, 13)).stage())
                .isEqualTo("Ingressa em 2027");
        assertThat(CourseProgress.of("20251ABCD000123", 2025, 0, null, 4, august).stage()).isNull();
    }

    private LocalDate exit(String enrollment, int entryYear, int extraSemesters) {
        return CourseProgress.of(enrollment, entryYear, extraSemesters, "SUPERIOR", 4, TODAY).expectedExit();
    }
}
