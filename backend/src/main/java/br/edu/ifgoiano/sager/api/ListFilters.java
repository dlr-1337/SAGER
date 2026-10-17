package br.edu.ifgoiano.sager.api;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Query fragments only receive column expressions owned by the caller. */
public final class ListFilters {
    private final Map<String,String> values;
    private final StringBuilder sql = new StringBuilder();
    private final List<Object> args = new ArrayList<>();
    public ListFilters(Map<String,String> values) { this.values=values;
        if (value("search").length()>200) throw invalid();
        try { if (!value("from").isBlank() && !value("to").isBlank() && LocalDate.parse(value("from")).isAfter(LocalDate.parse(value("to")))) throw invalid(); }
        catch (java.time.format.DateTimeParseException e) { throw invalid(); }
    }
    public ListFilters search(String expression) { if (!value("search").isBlank()) { sql.append(" AND position(sager_search_text(?) in sager_search_text(").append(expression).append(")) > 0"); args.add(value("search")); } return this; }
    public ListFilters equal(String key,String column) { if (!value(key).isBlank()) { if (value(key).length()>100) throw invalid(); sql.append(" AND ").append(column).append("=?"); args.add(value(key)); } return this; }
    public ListFilters resident(String expression) { if (!value("residentId").isBlank()) { try { args.add(UUID.fromString(value("residentId"))); } catch(IllegalArgumentException e) { throw invalid(); } sql.append(" AND ").append(expression).append("=?"); } return this; }
    public ListFilters uuid(String key,String predicate) {
        if (!value(key).isBlank()) { try { args.add(UUID.fromString(value(key))); } catch(IllegalArgumentException e) { throw invalid(); } sql.append(" AND ").append(predicate); }
        return this;
    }
    public ListFilters dates(String civilDateExpression) {
        for(String key:List.of("from","to")) if (!value(key).isBlank()) {
            try { args.add(LocalDate.parse(value(key))); } catch(java.time.format.DateTimeParseException e) { throw invalid(); }
            sql.append(" AND ").append(civilDateExpression).append(key.equals("from") ? ">=?" : "<=?");
        }
        return this;
    }
    public ListFilters acknowledged(String column) { if (!value("acknowledged").isBlank()) { if (!List.of("true","false").contains(value("acknowledged"))) throw invalid(); sql.append(" AND (").append(column).append(" IS NOT NULL)=?::boolean"); args.add(value("acknowledged")); } return this; }
    private String value(String key) { return values.getOrDefault(key, "").strip(); }
    public String sql() { return sql.toString(); }
    public List<Object> args() { return new ArrayList<>(args); }
    private static ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_REQUEST,"Filtros inválidos."); }
}
