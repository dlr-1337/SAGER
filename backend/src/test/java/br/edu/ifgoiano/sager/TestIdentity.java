package br.edu.ifgoiano.sager;
/** Explicit synthetic enrollments shared by fixtures; production never derives IDs from emails. */
public final class TestIdentity {
    private TestIdentity() {}
    public static String enrollment(String contact) { return contact.strip().split("@", 2)[0].toLowerCase(java.util.Locale.ROOT); }
}
