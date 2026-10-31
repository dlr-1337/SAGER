package br.edu.ifgoiano.sager.management.guardians;

import java.util.Set;
import java.util.regex.Pattern;

/** Canonical form is +55 plus area code and subscriber number. */
public final class BrazilianPhone {
    private static final Pattern TYPED = Pattern.compile("\\+?[0-9()\\-.\\s]+");
    private static final Pattern CANONICAL = Pattern.compile("\\+55[1-9][0-9]{9,10}");

    private BrazilianPhone() {}

    /** Returns null when the typed value cannot be read as a Brazilian number. */
    public static String canonical(String typed) {
        if (typed == null || !TYPED.matcher(typed).matches()) return null;
        String digits = typed.replaceAll("[^0-9]", "");
        if (typed.startsWith("+") && !digits.startsWith("55")) return null;
        if (digits.startsWith("0")) digits = digits.substring(1);
        String candidate =
                digits.startsWith("55") && (digits.length() == 12 || digits.length() == 13)
                        ? "+" + digits
                        : "+55" + digits;
        return CANONICAL.matcher(candidate).matches() ? candidate : null;
    }

    /** WhatsApp may keep an old account without the ninth digit; landlines (2-5) never vary. */
    public static Set<String> variants(String canonical) {
        if (canonical == null || !CANONICAL.matcher(canonical).matches())
            return canonical == null ? Set.of() : Set.of(canonical);
        String area = canonical.substring(0, 5), subscriber = canonical.substring(5);
        if (subscriber.length() == 9 && subscriber.charAt(0) == '9' && mobile(subscriber.charAt(1)))
            return Set.of(canonical, area + subscriber.substring(1));
        if (subscriber.length() == 8 && mobile(subscriber.charAt(0)))
            return Set.of(canonical, area + "9" + subscriber);
        return Set.of(canonical);
    }

    public static boolean same(String first, String second) {
        return first != null && second != null && variants(first).contains(second);
    }

    private static boolean mobile(char firstDigit) {
        return firstDigit < '2' || firstDigit > '5';
    }
}
