package br.edu.ifgoiano.sager.api;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("local")
public class CommunicationOpenApiConfiguration {
    @Bean
    OpenApiCustomizer communicationContracts() {
        return api -> {
            var version = new ObjectSchema().addProperty("version", version()).required(List.of("version"));
            var motivated = copy(version).addProperty("reason", text(10, 2000))
                    .required(List.of("version", "reason"));
            body(api, "/notificacoes/{id}/visualizar", "NotificationViewRequest", version);
            body(api, "/notificacoes/{id}/analisar", "NotificationAnalysisRequest",
                    copy(version).addProperty("confirmCurrentEvidence", new BooleanSchema())
                            .addProperty("reason", text(10, 2000).nullable(true)));
            body(api, "/notificacoes/{id}/arquivar", "NotificationArchiveRequest",
                    copy(motivated).addProperty("reasonCode", choice("ORIGEM_RETIFICADA", "SEM_EVIDENCIA", "NAO_PROCEDE", "OUTRO"))
                            .required(List.of("version", "reason", "reasonCode")));
            var warning = new ObjectSchema().addProperty("idempotencyKey", uuid())
                    .addProperty("category", choice("AUSENCIA", "ATRASO_RETORNO", "LIMPEZA", "OUTRA"))
                    .addProperty("severity", choice("LEVE", "MODERADA", "GRAVE"))
                    .addProperty("description", text(3, 1800)).addProperty("justification", text(10, 1800))
                    .addProperty("warningDate", new StringSchema().format("date"))
                    .required(List.of("idempotencyKey", "category", "severity", "description", "justification", "warningDate"));
            body(api, "/advertencias", "WarningCreateRequest", copy(warning)
                    .addProperty("residentId", uuid()).addProperty("occurrenceId", uuid().nullable(true))
                    .required(List.of("residentId", "idempotencyKey", "category", "severity", "description", "justification", "warningDate")));
            body(api, "/notificacoes/{id}/converter", "NotificationConversionRequest", copy(warning)
                    .addProperty("version", version())
                    .required(List.of("version", "idempotencyKey", "category", "severity", "description", "justification", "warningDate")));
            body(api, "/advertencias/{id}/anular", "WarningAnnulRequest", motivated);
            body(api, "/termos/{id}/anular", "TermAnnulRequest", copy(motivated));
            body(api, "/residentes/{id}/termos", "TermIssueRequest", new ObjectSchema()
                    .addProperty("warningIds", ids(2)).addProperty("decision", text(10, 2000))
                    .addProperty("confirmed", new BooleanSchema()._enum(List.of(true)))
                    .addProperty("idempotencyKey", uuid())
                    .required(List.of("warningIds", "decision", "confirmed", "idempotencyKey")));
            var notice = new ObjectSchema().addProperty("title", text(3, 200))
                    .addProperty("body", text(3, 4000)).addProperty("residentIds", ids(1))
                    .addProperty("idempotencyKey", uuid())
                    .required(List.of("title", "body", "residentIds", "idempotencyKey"));
            body(api, "/avisos", "NoticeCreateRequest", notice);
            body(api, "/avisos/{id}/publicar", "NoticePublishRequest", copy(version)
                    .addProperty("idempotencyKey", uuid()).required(List.of("version", "idempotencyKey")));
            body(api, "/avisos/{id}/revisar", "NoticeRevisionRequest", new ObjectSchema()
                    .addProperty("version", version()).addProperty("title", text(3, 200))
                    .addProperty("body", text(3, 4000)).addProperty("idempotencyKey", uuid())
                    .required(List.of("version", "title", "body", "idempotencyKey")));
            body(api, "/avisos/{id}/retirar", "NoticeWithdrawRequest", copy(motivated));
            body(api, "/me/comunicacoes/{id}/leitura", "CommunicationReadRequest", copy(version));
            body(api, "/me/comunicacoes/{id}/ciencia", "CommunicationAcknowledgeRequest", copy(version));
            api.getPaths().forEach((path, item) -> {
                if (!matches(path)) return;
                item.readOperations().forEach(operation -> operation.setDescription(
                        "Supervisor conduz análise, advertência e publicação humana. Residente consulta somente "
                        + "comunicações do UUID vinculado à sua conta. GET não registra leitura ou ciência. "
                        + "Leitura e ciência explícitas preservam o primeiro horário da versão informada; "
                        + "ciência local não é assinatura eletrônica. Correção da origem exige revisão humana. "
                        + "Reincidência considera duas origens distintas da mesma categoria em 90 dias, "
                        + "sem gerar termo automaticamente. Datas civis seguem America/Sao_Paulo. "
                        + "IdempotencyKey repetida exige corpo idêntico; version desatualizada retorna 409."));
                if (path.endsWith("/documento") && item.getGet() != null) {
                    item.getGet().getResponses().addApiResponse("200", new ApiResponse()
                            .description("PDF imutável privado, com integridade conferida e sem cache.")
                            .content(new Content().addMediaType("application/pdf", new MediaType()
                                    .schema(new StringSchema().format("binary")))));
                    item.getGet().getResponses().addApiResponse("503", new ApiResponse()
                            .description("Documento privado indisponível ou com integridade inválida.")
                            .content(new Content().addMediaType("application/json", new MediaType()
                                    .schema(new Schema<>().$ref("#/components/schemas/ApiError")))));
                }
            });
        };
    }

    private boolean matches(String path) {
        return path.startsWith("/api/v1/ocorrencias") || path.startsWith("/api/v1/notificacoes")
                || path.startsWith("/api/v1/advertencias") || path.startsWith("/api/v1/avisos")
                || path.startsWith("/api/v1/termos") || path.startsWith("/api/v1/me/comunicacoes")
                || path.startsWith("/api/v1/me/avisos") || path.startsWith("/api/v1/me/advertencias")
                || path.startsWith("/api/v1/me/termos") || path.endsWith("/reincidencias")
                || path.endsWith("/termos");
    }

    private void body(OpenAPI api, String path, String name, Schema<?> schema) {
        schema.setAdditionalProperties(false);
        api.getComponents().addSchemas(name, schema);
        api.getPaths().get("/api/v1" + path).getPost().setRequestBody(new RequestBody().required(true)
                .content(new Content().addMediaType("application/json", new MediaType()
                        .schema(new Schema<>().$ref("#/components/schemas/" + name)))));
    }

    private ObjectSchema copy(Schema<?> schema) {
        var copy = new ObjectSchema();
        copy.setProperties(new LinkedHashMap<>(schema.getProperties()));
        copy.setRequired(schema.getRequired() == null ? null : List.copyOf(schema.getRequired()));
        return copy;
    }

    private Schema<?> version() {
        return new IntegerSchema().format("int64").minimum(BigDecimal.ZERO)
                .maximum(BigDecimal.valueOf(Long.MAX_VALUE - 1));
    }

    private Schema<?> uuid() { return new StringSchema().format("uuid"); }
    private Schema<?> text(int min, int max) { return new StringSchema().minLength(min).maxLength(max); }
    private Schema<?> choice(String... values) { return new StringSchema()._enum(List.of(values)); }
    private Schema<?> ids(int minimum) {
        return new ArraySchema().items(uuid()).minItems(minimum).maxItems(100).uniqueItems(true);
    }
}
