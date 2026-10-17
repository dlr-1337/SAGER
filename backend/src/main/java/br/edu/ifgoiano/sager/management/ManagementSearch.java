package br.edu.ifgoiano.sager.management;

import java.text.Normalizer;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

/** Optional paging keeps the existing unpaged array contract for selector callers. */
public final class ManagementSearch {
    private ManagementSearch() {}
    public record Page<T>(List<T> items, long total) {}
    public static <T> Page<T> query(JdbcTemplate jdbc, String select, String table, String searchFields,
            String exactField, String order, Map<String,String> filters, Map<String,String> params, RowMapper<T> mapper) {
        Set<String> allowed = new HashSet<>(filters.keySet()); allowed.addAll(Set.of("search", "offset", "limit"));
        if (!allowed.containsAll(params.keySet())) throw bad();
        String search = normalize(params.getOrDefault("search", ""));
        if (search.length() > 200) throw bad();
        try {
            for (String key : List.of("from", "to", "date")) if (params.containsKey(key) && !params.get(key).isBlank()) java.time.LocalDate.parse(params.get(key));
            if (params.containsKey("from") && params.containsKey("to") && !params.get("from").isBlank() && !params.get("to").isBlank() && java.time.LocalDate.parse(params.get("from")).isAfter(java.time.LocalDate.parse(params.get("to")))) throw bad();
        } catch (java.time.format.DateTimeParseException error) { throw bad(); }
        List<Object> args = new ArrayList<>(); List<String> where = new ArrayList<>();
        if (!search.isEmpty()) { where.add("position(? in sager_search_text(" + searchFields + ")) > 0"); args.add(search); }
        for (var filter : new TreeMap<>(filters).entrySet()) {
            String value = params.get(filter.getKey());
            if (value == null || value.isBlank()) continue;
            if (filter.getKey().endsWith("Id")) { try { UUID.fromString(value); } catch (IllegalArgumentException error) { throw bad(); } }
            if (Set.of("active", "allocated", "vacancy").contains(filter.getKey()) && !Set.of("true", "false").contains(value)) throw bad();
            where.add(filter.getValue()); args.add(value);
        }
        String condition = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        Long count = jdbc.queryForObject("SELECT count(*) FROM " + table + condition, Long.class, args.toArray());
        String ranking = "";
        if (!search.isEmpty()) { ranking = "CASE WHEN sager_search_text(" + exactField + ") = ? THEN 0 ELSE 1 END, "; args.add(search); }
        String paging = "";
        if (params.containsKey("limit") || params.containsKey("offset")) {
            int limit = number(params.getOrDefault("limit", "25"), 1, 100);
            int offset = number(params.getOrDefault("offset", "0"), 0, 1000000);
            paging = " LIMIT ? OFFSET ?"; args.add(limit); args.add(offset);
        }
        return new Page<>(jdbc.query("SELECT " + select + " FROM " + table + condition + " ORDER BY " + ranking + order + paging, mapper, args.toArray()), count == null ? 0 : count);
    }
    private static int number(String value, int min, int max) {
        try { int number = Integer.parseInt(value); if (number < min || number > max) throw bad(); return number; }
        catch (NumberFormatException error) { throw bad(); }
    }
    public static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
    private static ResponseStatusException bad() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Critérios de busca inválidos."); }
}
