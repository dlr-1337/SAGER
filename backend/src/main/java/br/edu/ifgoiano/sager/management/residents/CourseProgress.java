package br.edu.ifgoiano.sager.management.residents;

import java.time.LocalDate;

/** Etapa, saída prevista e conclusão do curso; a única conta, usada pela API, pela rotina e pela alocação. */
public record CourseProgress(String stage, LocalDate expectedExit, boolean concluded) {
    private static final CourseProgress UNKNOWN = new CourseProgress(null, null, false);

    public static CourseProgress of(String enrollment, Integer entryYear, int extraSemesters, String level,
            Integer durationYears, LocalDate today) {
        if (entryYear == null || durationYears == null) return UNKNOWN;
        // Semestres contados como ano * 2 + (0 no 1º, 1 no 2º); fora do padrão vale o 2º, para não encerrar cedo.
        int start = entryYear * 2 + (enrollment != null && enrollment.length() > 4 && enrollment.charAt(4) == '1' ? 0 : 1);
        int last = start + durationYears * 2 - 1 + extraSemesters;
        LocalDate exit = last % 2 == 0 ? LocalDate.of(last / 2, 6, 30) : LocalDate.of(last / 2, 12, 31);
        if (today.isAfter(exit)) return new CourseProgress("Concluinte", exit, true);
        if (level == null) return new CourseProgress(null, exit, false);
        int elapsed = today.getYear() * 2 + (today.getMonthValue() >= 7 ? 1 : 0) - start;
        String stage = elapsed < 0 ? "Ingressa em " + entryYear
                : "MEDIO".equals(level) ? (elapsed / 2 + 1) + "º ano" : (elapsed + 1) + "º período";
        return new CourseProgress(stage, exit, false);
    }
}
