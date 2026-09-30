package br.edu.ifgoiano.sager.api;

import java.math.BigDecimal;
import java.util.List;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.NumberSchema;
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
@Profile({ "local", "production" })
public class ReportingOpenApiConfiguration {
    @Bean
    OpenApiCustomizer reportingContracts() {
        return api -> {
            ObjectSchema criteria = new ObjectSchema();
            for (String criterion : List.of("PISO", "SUPERFICIES", "RESIDUOS", "ORGANIZACAO")) {
                criteria.addProperty(criterion, new NumberSchema().minimum(BigDecimal.ZERO)
                        .maximum(BigDecimal.TEN).multipleOf(new BigDecimal("0.1")));
            }
            criteria.required(List.of("PISO", "SUPERFICIES", "RESIDUOS", "ORGANIZACAO"));
            criteria.setAdditionalProperties(false);
            body(api, "/limpeza/avaliacoes", "CleaningAssessmentCreateRequest", new ObjectSchema()
                    .addProperty("roomId", uuid()).addProperty("timeMode", choice("NOW", "RETROACTIVE"))
                    .addProperty("evaluatedAt", new StringSchema().format("date-time"))
                    .addProperty("registrationReason", text(10, 2000))
                    .addProperty("criteria", criteria).addProperty("observation", text(1, 2000).nullable(true))
                    .addProperty("idempotencyKey", uuid())
                    .required(List.of("roomId", "timeMode", "criteria", "idempotencyKey")));
            body(api, "/limpeza/avaliacoes/{id}/corrigir", "CleaningAssessmentCorrectionRequest",
                    new ObjectSchema().addProperty("version", new IntegerSchema().format("int64")
                            .minimum(BigDecimal.ZERO).maximum(BigDecimal.valueOf(Long.MAX_VALUE - 1)))
                            .addProperty("criteria", criteria).addProperty("observation", text(1, 2000).nullable(true))
                            .addProperty("reason", text(10, 2000)).required(List.of("version", "criteria", "reason")));
            Schema<?> filters = new ObjectSchema()
                    .addProperty("from", new StringSchema().format("date"))
                    .addProperty("to", new StringSchema().format("date"))
                    .addProperty("accommodationId", uuid().nullable(true)).addProperty("roomId", uuid().nullable(true))
                    .addProperty("residentId", uuid().nullable(true)).addProperty("status", text(1, 40).nullable(true))
                    .required(List.of("from", "to"));
            filters.setAdditionalProperties(false);
            body(api, "/relatorios/consultas", "ReportSnapshotCreateRequest", new ObjectSchema()
                    .addProperty("catalogCode", choice("PRESENCA", "SAIDAS", "LIMPEZA", "OCORRENCIAS",
                            "NOTIFICACOES", "ADVERTENCIAS", "TERMOS", "CONSOLIDADO"))
                    .addProperty("filters", filters).addProperty("idempotencyKey", uuid())
                    .required(List.of("catalogCode", "filters", "idempotencyKey")));
            body(api, "/relatorios/consultas/{id}/exportacoes", "ReportExportRequest", new ObjectSchema()
                    .addProperty("format", choice("PDF", "XLSX")).required(List.of("format")));
            api.getPaths().forEach((path, item) -> {
                if (!path.startsWith("/api/v1/limpeza") && !path.startsWith("/api/v1/me/limpeza")
                        && !path.startsWith("/api/v1/relatorios")) return;
                item.readOperations().forEach(operation -> {
                    String description = path.contains("/relatorios")
                            ? "Gestor/supervisor criam consulta privada do autor: período inclusivo de até 366 dias, "
                                    + "até 10.000 linhas, excesso recusado. Snapshot imutável por 24 horas; prévia "
                                    + "padrão 20/máximo 100 e exportação integral usam os mesmos dados. "
                                    + "Download exige autor/permissão atuais e integridade. Expiração remove apenas "
                                    + "artefatos transitórios; documentos permanentes e auditoria são preservados. "
                                    + "Exportação deduplicada por snapshot/formato; estado consultado explicitamente."
                            : "Supervisor grava/corrige. NOW usa relógio do servidor; RETROACTIVE exige evaluatedAt "
                                    + "não futuro e registrationReason de pelo menos 10 caracteres. Uma avaliação por "
                                    + "quarto/data America/Sao_Paulo, participantes históricos capturados. Quatro critérios "
                                    + "com peso igual; média HALF_UP com duas casas. Correção preserva quarto/data e "
                                    + "histórico. Ranking WEEK/MONTH/SEMESTER tem empates 1,1,3 e ausências null. "
                                    + "Residente consulta somente avaliações próprias e código/posição dos outros quartos.";
                    operation.setDescription(description);
                    for (String status : List.of("409", "410", "503")) {
                        operation.getResponses().addApiResponse(status, new ApiResponse()
                                .description(status.equals("409") ? "Conflito de versão, duplicidade ou tarefa ainda pendente."
                                        : status.equals("410") ? "Consulta ou exportação privada expirada."
                                                : "Documento indisponível ou com integridade inválida.")
                                .content(new Content().addMediaType("application/json", new MediaType()
                                        .schema(new Schema<>().$ref("#/components/schemas/ApiError")))));
                    }
                });
                if (path.endsWith("/arquivo") && item.getGet() != null) {
                    item.getGet().getResponses().addApiResponse("200", new ApiResponse()
                            .description("Arquivo privado íntegro da consulta, sem cache.")
                            .content(new Content().addMediaType("application/pdf", new MediaType()
                                    .schema(new StringSchema().format("binary")))
                                    .addMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                            new MediaType().schema(new StringSchema().format("binary")))));
                }
            });
        };
    }

    private void body(OpenAPI api, String path, String name, Schema<?> schema) {
        schema.setAdditionalProperties(false);
        api.getComponents().addSchemas(name, schema);
        api.getPaths().get("/api/v1" + path).getPost().setRequestBody(new RequestBody().required(true)
                .content(new Content().addMediaType("application/json", new MediaType()
                        .schema(new Schema<>().$ref("#/components/schemas/" + name)))));
    }
    private Schema<?> text(int minimum, int maximum) { return new StringSchema().minLength(minimum).maxLength(maximum); }
    private Schema<?> uuid() { return new StringSchema().format("uuid"); }
    private Schema<?> choice(String... values) { return new StringSchema()._enum(List.of(values)); }
}
