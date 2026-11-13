package br.edu.ifgoiano.sager.management;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Mantenha igual a frontend/src/app/shared/field-rules.ts: o erro 400 não diz qual regra falhou. */
public final class FieldRules {
    private static final ZoneId CIVIL_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final String WORD = "\\p{L}[\\p{L}\\p{M}]*(?:['-]\\p{L}[\\p{L}\\p{M}]*)*";
    private static final Pattern NAME = Pattern.compile(WORD + "(?: " + WORD + ")+");
    private static final Set<String> PARTICLES = Set.of("de", "da", "do", "das", "dos", "e");
    private static final Pattern RESIDENT_ENROLLMENT = Pattern.compile("20\\d{3}[0-9A-Z]{10,12}");
    private static final Pattern SUPERVISOR_ID = Pattern.compile("[0-9A-Za-z-]{4,20}");
    private static final Pattern RESIDENT_EMAIL =
            Pattern.compile("[a-z0-9]+(?:[._-][a-z0-9]+)*@estudante\\.ifgoiano\\.edu\\.br");

    private FieldRules() {}

    public static String normalizeName(String value) {
        return Normalizer.normalize(
                value.replaceAll("[\\s\\p{Z}]+", " ").strip().replace('’', '\''),
                Normalizer.Form.NFC);
    }

    public static boolean validName(String normalized) {
        return NAME.matcher(normalized).matches()
                && Arrays.stream(normalized.split(" ")).filter(FieldRules::significant).count() >= 2;
    }

    private static boolean significant(String word) {
        String lower = word.toLowerCase(Locale.ROOT);
        return !PARTICLES.contains(lower)
                && (lower.equals("ó") || lower.codePoints().filter(Character::isLetter).count() >= 2);
    }

    public static String normalizeEnrollment(String value) {
        return value.replaceAll("[\\s\\p{Z}./-]", "").toUpperCase(Locale.ROOT);
    }

    public static boolean validResidentEnrollment(String normalized) {
        return RESIDENT_ENROLLMENT.matcher(normalized).matches()
                && Integer.parseInt(normalized.substring(0, 4)) <= LocalDate.now(CIVIL_ZONE).getYear();
    }

    public static boolean validSupervisorId(String value) {
        return SUPERVISOR_ID.matcher(value).matches();
    }

    public static boolean validResidentEmail(String lowerCase) {
        return RESIDENT_EMAIL.matcher(lowerCase).matches();
    }

    public static boolean plausibleBirthDate(LocalDate birthDate) {
        Period age = Period.between(birthDate, LocalDate.now(CIVIL_ZONE));
        return !age.isNegative() && age.getYears() >= 10 && age.getYears() <= 100;
    }

    public static boolean hasLetter(String value) {
        return value.codePoints().anyMatch(Character::isLetter);
    }

    public static boolean validCapacity(int capacity) {
        return capacity >= 1 && capacity <= 20;
    }

    /** Menor de 18 anos na data civil de America/Sao_Paulo do instante; sem data ou data futura não é menor. */
    public static boolean minor(LocalDate birth, Instant at) {
        LocalDate date = at.atZone(CIVIL_ZONE).toLocalDate();
        return birth != null && !birth.isAfter(date) && birth.plusYears(18).isAfter(date);
    }

    public static boolean validEntryYear(int year) {
        return year >= 1990 && year <= LocalDate.now(CIVIL_ZONE).getYear() + 1;
    }
}
