package br.edu.ifgoiano.sager.api;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.RequestBody;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("local")
public class OperationsOpenApiConfiguration {
    @Bean
    OpenApiCustomizer operationsContracts() {
        return api -> {
            var window = new ObjectSchema()
                    .addProperty("outsideWindowConfirmed", new BooleanSchema()._default(false))
                    .addProperty("justification", text(10, true));
            var open = copy(window).addProperty("accommodationId", uuid(false))
                    .required(List.of("accommodationId"));
            body(api, "/api/v1/chamadas", false, "NightCallOpenRequest", open);
            var close = copy(window).addProperty("version", version()).required(List.of("version"));
            body(api, "/api/v1/chamadas/{id}/fechamento", false, "NightCallCloseRequest", close);
            var mark = new ObjectSchema()
                    .addProperty("version", version())
                    .addProperty("mark", choice("PRESENTE", "AUSENTE", "AUSENCIA_JUSTIFICADA"))
                    .addProperty("authorizedExitId", uuid(true))
                    .addProperty("authorizedExitType", choice("SHORT", "LONG").nullable(true))
                    .required(List.of("version", "mark"));
            body(api, "/api/v1/chamadas/{id}/registros/{residentId}", true, "NightCallMarkRequest", mark);
            body(api, "/api/v1/chamadas/{id}/correcoes/{residentId}", false, "NightCallCorrectionRequest",
                    copy(mark).addProperty("justification", text(10, false))
                            .required(List.of("version", "mark", "justification")));
            var plan = new ObjectSchema()
                    .addProperty("departureMode", choice("NOW", "SCHEDULED"))
                    .addProperty("requestedDepartureAt", instant(true))
                    .addProperty("expectedReturnAt", instant(false))
                    .addProperty("reason", text(3, false)).addProperty("notes", text(1, true))
                    .required(List.of("departureMode", "expectedReturnAt", "reason"));
            body(api, "/api/v1/saidas-curtas", false, "ShortExitCreateRequest", plan);
            body(api, "/api/v1/saidas-curtas/{id}", true, "ShortExitUpdateRequest",
                    copy(plan).addProperty("version", version())
                            .required(List.of("version", "departureMode", "expectedReturnAt", "reason")));
            body(api, "/api/v1/saidas-curtas/{id}/decisao", false, "ShortExitDecisionRequest",
                    new ObjectSchema().addProperty("version", version())
                            .addProperty("decision", choice("APPROVE", "REJECT"))
                            .addProperty("comment", text(1, true)).required(List.of("version", "decision")));
            body(api, "/api/v1/saidas-curtas/{id}/cancelamento", false, "ShortExitCancelRequest",
                    new ObjectSchema().addProperty("version", version()).addProperty("comment", text(10, false))
                            .required(List.of("version", "comment")));
            var physical = new ObjectSchema().addProperty("version", version())
                    .addProperty("timeMode", choice("NOW", "RETROACTIVE"))
                    .addProperty("occurredAt", instant(true)).addProperty("justification", text(1, true))
                    .required(List.of("version", "timeMode"));
            body(api, "/api/v1/saidas-curtas/{id}/partida", false, "ShortExitDepartureRequest", physical);
            body(api, "/api/v1/saidas-curtas/{id}/retorno", false, "ShortExitReturnRequest",
                    copy(physical).addProperty("lateObservation", text(1, true)));
            api.getPaths().forEach((path, item) -> {
                if (path.startsWith("/api/v1/chamadas") || path.startsWith("/api/v1/saidas-curtas")) {
                    item.readOperations().forEach(operation -> operation.setDescription(
                            "Operação local: somente supervisor opera chamadas e confirma movimentos físicos. "
                            + "Residente solicita e consulta a própria saída. Version é inteiro não negativo. "
                            + "America/Sao_Paulo governa datas civis; instantes têm fuso explícito. "
                            + "NOW omite a hora enviada; SCHEDULED exige requestedDepartureAt. "
                            + "Janela excepcional, rejeição, registro retroativo e retorno atrasado exigem "
                            + "justificativa correspondente de pelo menos 10 caracteres. "
                            + "Ausência justificada exige autorização e partida válidas no instante da chamada."));
                }
            });
        };
    }

    private void body(OpenAPI api, String path, boolean put, String name, Schema<?> schema) {
        schema.setAdditionalProperties(false);
        api.getComponents().addSchemas(name, schema);
        Operation operation = put ? api.getPaths().get(path).getPut() : api.getPaths().get(path).getPost();
        operation.setRequestBody(new RequestBody().required(true).content(new Content()
                .addMediaType("application/json", new MediaType()
                        .schema(new Schema<>().$ref("#/components/schemas/" + name)))));
    }

    private ObjectSchema copy(Schema<?> schema) {
        var result = new ObjectSchema();
        result.setProperties(new LinkedHashMap<>(schema.getProperties()));
        result.setRequired(schema.getRequired() == null ? null : List.copyOf(schema.getRequired()));
        return result;
    }

    private Schema<?> version() {
        return new IntegerSchema().format("int64").minimum(BigDecimal.ZERO)
                .maximum(BigDecimal.valueOf(Long.MAX_VALUE - 1));
    }

    private Schema<?> text(int minimum, boolean nullable) {
        return new StringSchema().minLength(minimum).maxLength(2000).nullable(nullable);
    }

    private Schema<?> uuid(boolean nullable) {
        return new StringSchema().format("uuid").nullable(nullable);
    }

    private Schema<?> instant(boolean nullable) {
        return new StringSchema().format("date-time").nullable(nullable);
    }

    private StringSchema choice(String... values) {
        return new StringSchema()._enum(List.of(values));
    }
}
