package br.edu.ifgoiano.sager.api;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile({ "local", "production" })
public class LongExitOpenApiConfiguration {
    @Bean
    OpenApiCustomizer longExitContracts() {
        return api -> {
            String base = "/api/v1/saidas-longas";
            var plan = new ObjectSchema().addProperty("departureMode", choice("NOW", "SCHEDULED"))
                    .addProperty("requestedDepartureAt", instant(true))
                    .addProperty("expectedReturnAt", instant(false))
                    .addProperty("reason", text(3, false)).addProperty("notes", text(1, true))
                    .addProperty("guardianId", uuid(false))
                    .required(List.of("departureMode", "expectedReturnAt", "reason", "guardianId"));
            body(api, base, false, "LongExitCreateRequest", plan);
            body(api, base + "/{id}", true, "LongExitUpdateRequest",
                    copy(plan).addProperty("version", version())
                            .required(List.of("version", "departureMode", "expectedReturnAt", "reason", "guardianId")));
            body(api, base + "/{id}/decisao", false, "LongExitDecisionRequest",
                    new ObjectSchema().addProperty("version", version())
                            .addProperty("decision", choice("APPROVE", "REJECT"))
                            .addProperty("documentVersionId", uuid(true)).addProperty("comment", text(1, true))
                            .required(List.of("version", "decision")));
            body(api, base + "/{id}/cancelamento", false, "LongExitCancelRequest",
                    new ObjectSchema().addProperty("version", version()).addProperty("comment", text(10, false))
                            .required(List.of("version", "comment")));
            var physical = new ObjectSchema().addProperty("version", version())
                    .addProperty("timeMode", choice("NOW", "RETROACTIVE"))
                    .addProperty("occurredAt", instant(true)).addProperty("justification", text(1, true))
                    .required(List.of("version", "timeMode"));
            body(api, base + "/{id}/partida", false, "LongExitDepartureRequest", physical);
            body(api, base + "/{id}/retorno", false, "LongExitReturnRequest",
                    copy(physical).addProperty("lateObservation", text(1, true)));
            body(api, base + "/{id}/reenvio", false, "LongExitResendRequest",
                    new ObjectSchema().addProperty("version", version()).addProperty("guardianId", uuid(true))
                            .addProperty("comment", text(10, false)).required(List.of("version", "comment")));
            body(api, base + "/{id}/reconciliacao", false, "LongExitReconcileRequest",
                    new ObjectSchema().addProperty("version", version()).required(List.of("version")));
            api.getComponents().addSecuritySchemes("signatureCapability", new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("opaque 32-byte capability")
                    .description("Convite opaco de 43 caracteres, somente em memória; nunca cookie ou query string."));
            api.getPaths().forEach((path, item) -> {
                if (path.startsWith(base)) {
                    item.readOperations().forEach(operation -> operation.setDescription(
                            "Saída longa: duração solicitada superior a três horas; relógio do servidor e "
                            + "America/Sao_Paulo para datas civis. Residente consulta/solicita a própria saída. "
                            + "Supervisor decide e confirma movimentos físicos. NOW omite a hora enviada; "
                            + "SCHEDULED exige requestedDepartureAt. APPROVE exige documentVersionId atual, "
                            + "PDF íntegro e assinatura VALID conferida pelo servidor. REJECT, cancelamento, "
                            + "reenvio, horário retroativo e atraso exigem motivo correspondente de 10 caracteres. "
                            + "Reenvio revoga o convite anterior; callback do widget não valida assinatura."));
                }
                if (path.startsWith("/api/v1/assinaturas/")) {
                    item.readOperations().forEach(operation -> operation.setSecurity(
                            List.of(new SecurityRequirement().addList("signatureCapability"))));
                }
                if (path.startsWith(base) || path.startsWith("/api/v1/assinaturas/")) {
                    item.readOperations().forEach(operation -> operation.getResponses().addApiResponse("503",
                            new ApiResponse().description("Documento ou integração indisponível.")
                                    .content(new Content().addMediaType("application/json", new MediaType()
                                            .schema(new Schema<>().$ref("#/components/schemas/ApiError"))))));
                }
                if (path.contains("/documentos/") && path.startsWith(base)
                        || path.equals("/api/v1/assinaturas/documento")) {
                    item.getGet().getResponses().addApiResponse("200", new ApiResponse()
                            .description("PDF privado íntegro; resposta sem cache.")
                            .content(new Content().addMediaType("application/pdf", new MediaType()
                                    .schema(new StringSchema().format("binary")))));
                }
                if (path.equals("/api/v1/webhooks/whatsapp") && item.getGet() != null) {
                    item.getGet().setSecurity(List.of());
                }
                if (path.startsWith("/api/v1/webhooks/") && item.getPost() != null) {
                    String scheme = path.endsWith("clicksign") ? "clicksignHmac" : "metaHmac";
                    String header = path.endsWith("clicksign") ? "Content-Hmac" : "X-Hub-Signature-256";
                    api.getComponents().addSecuritySchemes(scheme, new SecurityScheme()
                            .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER).name(header)
                            .description("HMAC-SHA256 dos bytes brutos; segredo exclusivo do provedor."));
                    item.getPost().setSecurity(List.of(new SecurityRequirement().addList(scheme)));
                    item.getPost().setDescription("Webhook autenticado por HMAC, sem cookie e sem CSRF. "
                            + "Persiste inbox e deduplica; entrega não equivale a assinatura validada.");
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
