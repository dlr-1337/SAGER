package br.edu.ifgoiano.sager.discipline;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;

public final class DisciplineInput {
    private DisciplineInput() {}
    public static void object(JsonNode body) { if (body == null || !body.isObject()) throw invalid("Informe objeto JSON."); }
    public static void fields(JsonNode body,String... fields) {
        object(body);Set<String> allowed=Set.of(fields);
        for(var entry:body.properties()) if(!allowed.contains(entry.getKey())) throw invalid("Campo não permitido: "+entry.getKey());
    }
    public static String text(JsonNode body, String field, int minimum, int maximum) {
        object(body); JsonNode value = body.get(field);
        if (value == null || !value.isString()) throw invalid(field + " deve ser texto.");
        String text = value.stringValue().trim();
        if (text.length() < minimum || text.length() > maximum || text.matches("(?s).*<[A-Za-z!/][^>]*>.*")) throw invalid(field + " inválido.");
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t') throw invalid(field + " contém caracteres inválidos.");
            if (Character.isLowSurrogate(c)) throw invalid(field + " contém caracteres inválidos.");
            if (Character.isHighSurrogate(c)) {
                if (i + 1 >= text.length() || !Character.isLowSurrogate(text.charAt(++i))) throw invalid(field + " contém caracteres inválidos.");
            }
        }
        return text;
    }
    public static String option(JsonNode body,String field,Set<String> allowed) {
        String text=text(body,field,1,40); if (!allowed.contains(text)) throw invalid(field + " inválido."); return text;
    }
    public static UUID uuid(JsonNode body,String field) {
        String text=text(body,field,36,36);
        if (!text.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) throw invalid(field + " deve ser UUID.");
        return UUID.fromString(text);
    }
    public static UUID optionalUuid(JsonNode body,String field) { return !body.hasNonNull(field) ? null : uuid(body,field); }
    public static long version(JsonNode body) {
        object(body); var value=body.get("version");
        if (value==null || !value.isIntegralNumber() || !value.canConvertToLong() || value.asLong()<0 || value.asLong()==Long.MAX_VALUE) throw invalid("version inválida.");
        return value.asLong();
    }
    public static LocalDate date(JsonNode body,String field) {
        try { return LocalDate.parse(text(body,field,10,10)); } catch (java.time.DateTimeException error) { throw invalid(field + " inválida."); }
    }
    public static List<UUID> ids(JsonNode body,String field,int minimum) {
        object(body); var values=body.get(field); if (values==null || !values.isArray() || values.size()<minimum || values.size()>100) throw invalid(field + " deve conter " + minimum + " a 100 UUIDs.");
        List<UUID> ids=new ArrayList<>(); for(var value:values) {
            var holder=tools.jackson.databind.node.JsonNodeFactory.instance.objectNode(); holder.set("id",value); ids.add(uuid(holder,"id"));
        }
        if(new HashSet<>(ids).size()!=ids.size()) throw invalid("Não repita IDs.");
        return ids.stream().sorted().toList();
    }
    public static int limit(int limit) { if(limit<1 || limit>100) throw invalid("limit deve estar entre 1 e 100."); return limit; }
    public static int limit(int limit,Long cursor) { if(cursor!=null && cursor<=0) throw invalid("beforeSequence deve ser positivo.");return limit(limit); }
    public static DisciplineApiException invalid(String message) { return new DisciplineApiException(HttpStatus.BAD_REQUEST,"invalid_input",message); }
    public static DisciplineApiException missing() { return new DisciplineApiException(HttpStatus.NOT_FOUND,"not_found","Registro não encontrado."); }
    public static DisciplineApiException conflict(String code,String message) { return new DisciplineApiException(HttpStatus.CONFLICT,code,message); }
}
