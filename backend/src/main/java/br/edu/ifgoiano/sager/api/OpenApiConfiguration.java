package br.edu.ifgoiano.sager.api;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile({ "local", "production" })
public class OpenApiConfiguration {
    @Bean
    OpenAPI localOpenApi() {
        return new OpenAPI().info(new Info().title("SAGER — API local").version("0.1.0")
                .description("Contrato implementado em desenvolvimento, restrito a loopback. "
                        + "Gestor e supervisor têm as mesmas permissões de gestão. "
                        + "Instantes usam UTC; datas civis usam ISO 8601. "
                        + "PUT exige a versão lida; conflitos devolvem 409. "
                        + "Erros e auditoria compartilham X-Request-Id gerado no servidor. "
                        + "Escritas exigem o token X-CSRF-TOKEN obtido em /api/v1/auth/csrf."))
                .components(new Components().addSecuritySchemes("sessionCookie", new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE).name("SESSION")))
                .addSecurityItem(new SecurityRequirement().addList("sessionCookie"));
    }

    @Bean
    OpenApiCustomizer implementedContracts() {
        return api -> {
            // JsonNode request fields deliberately enforce JSON types at runtime. Give each
            // request a distinct schema rather than exposing Jackson internals or ambiguous names.
            crud(api, "/api/v1/residentes", "Resident", new ObjectSchema()
                    .addProperty("name", text(3, 200, false))
                    .addProperty("enrollment", text(1, 64, false))
                    .addProperty("birthDate", new StringSchema().format("date"))
                    .addProperty("course", text(0, 200, true)), List.of("name", "enrollment", "birthDate"));
            crud(api, "/api/v1/supervisores", "Supervisor", new ObjectSchema()
                    .addProperty("name", text(1, 200, false))
                    .addProperty("institutionalId", text(1, 64, false))
                    .addProperty("email", new StringSchema().format("email").maxLength(320)),
                    List.of("name", "institutionalId", "email"));
            crud(api, "/api/v1/alojamentos", "Accommodation", new ObjectSchema()
                    .addProperty("code", text(1, 64, false)).addProperty("name", text(1, 200, false)),
                    List.of("code", "name"));
            crud(api, "/api/v1/alojamentos/{id}/unidades", "AccommodationUnit", new ObjectSchema()
                    .addProperty("code", text(1, 64, false)).addProperty("name", text(1, 200, false)),
                    List.of("code", "name"));
            crud(api, "/api/v1/responsaveis", "Guardian", new ObjectSchema()
                    .addProperty("residentId", uuid(false)).addProperty("name", text(3, 200, false))
                    .addProperty("relationship", text(2, 80, false))
                    .addProperty("phone", text(0, 30, true)).addProperty("active", new BooleanSchema()),
                    List.of("residentId", "name", "relationship", "active"));
            crud(api, "/api/v1/quartos", "Room", new ObjectSchema()
                    .addProperty("code", text(1, 64, false)).addProperty("number", text(1, 64, false))
                    .addProperty("accommodationId", uuid(false)).addProperty("unitId", uuid(true))
                    .addProperty("floor", text(0, 64, true))
                    .addProperty("capacity", new IntegerSchema().minimum(BigDecimal.ONE)
                            .maximum(BigDecimal.valueOf(Integer.MAX_VALUE)).nullable(true))
                    .addProperty("situation", new StringSchema()._enum(List.of("Disponível", "Ocupado", "Manutenção", "Indisponível"))),
                    List.of("code", "number", "accommodationId", "situation"));
            request(api, "/api/v1/alocacoes", "AllocationCreateRequest", new ObjectSchema()
                    .addProperty("residentId", uuid(false)).addProperty("roomId", uuid(false))
                    .required(List.of("residentId", "roomId")));
            request(api, "/api/v1/alocacoes/{id}/transferir", "AllocationTransferRequest", new ObjectSchema()
                    .addProperty("roomId", uuid(false)).addProperty("version", version())
                    .required(List.of("roomId", "version")));
            request(api, "/api/v1/alocacoes/{id}/encerrar", "AllocationEndRequest", new ObjectSchema()
                    .addProperty("version", version()).required(List.of("version")));
            healthContracts(api);
            Schema<?> loginBody = new ObjectSchema()
                    .addProperty("email", new StringSchema().format("email"))
                    .addProperty("password", new StringSchema().format("password"))
                    .required(List.of("email", "password"));
            Operation login = new Operation()
                    .operationId("localLogin").summary("Entrar com e-mail e senha")
                    .security(List.of()).requestBody(new RequestBody().required(true).content(new Content()
                            .addMediaType("application/x-www-form-urlencoded", new MediaType().schema(loginBody))))
                    .responses(new ApiResponses().addApiResponse("204", new ApiResponse()
                            .description("Sessão criada; cookie HttpOnly emitido.")));
            api.getPaths().addPathItem("/api/v1/auth/login", new PathItem().post(login));
            api.getPaths().addPathItem("/api/v1/auth/logout", new PathItem().post(new Operation()
                    .operationId("localLogout").summary("Encerrar a sessão")
                    .responses(new ApiResponses().addApiResponse("204", new ApiResponse()
                            .description("Sessão invalidada no servidor.")))));
            api.getPaths().get("/api/v1/auth/csrf").getGet().setSecurity(List.of());
            api.getComponents().addSchemas("ApiError", new ObjectSchema()
                    .addProperty("code", new StringSchema()).addProperty("message", new StringSchema())
                    .addProperty("requestId", uuid(false)).required(List.of("code", "message", "requestId")));
            api.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
                if (operation.getResponses() == null) operation.setResponses(new ApiResponses());
                for (String status : List.of("400", "401", "403", "404", "409", "500")) {
                    operation.getResponses().addApiResponse(status, new ApiResponse()
                            .description("Erro seguro com code, message e requestId.").content(new Content()
                                    .addMediaType("application/json", new MediaType()
                                            .schema(new Schema<>().$ref("#/components/schemas/ApiError")))));
                }
            }));
            api.getPaths().forEach((path, item) -> {
                if (path.startsWith("/api/v1/responsaveis") || path.startsWith("/api/v1/alocacoes")) {
                    item.readOperations().forEach(operation -> operation.getResponses()
                            .addApiResponse("422", new ApiResponse().description("Referência cadastral inválida.")
                                    .content(new Content().addMediaType("application/json", new MediaType()
                                            .schema(new Schema<>().$ref("#/components/schemas/ApiError"))))));
                }
            });
        };
    }

    private void crud(OpenAPI api, String path, String name, Schema<?> schema, List<String> required) {
        schema.setRequired(required);
        String createName = name + "CreateRequest";
        api.getComponents().addSchemas(createName, schema);
        setRequest(api.getPaths().get(path).getPost(), createName);
        Schema<?> update = new ObjectSchema();
        update.setProperties(new LinkedHashMap<>(schema.getProperties()));
        update.addProperty("version", version());
        List<String> updateRequired = new ArrayList<>(required);
        updateRequired.add("version");
        update.setRequired(updateRequired);
        String updateName = name + "UpdateRequest";
        api.getComponents().addSchemas(updateName, update);
        String updatePath = path.contains("/unidades") ? path + "/{unitId}" : path + "/{id}";
        setRequest(api.getPaths().get(updatePath).getPut(), updateName);
    }

    private void request(OpenAPI api, String path, String name, Schema<?> schema) {
        api.getComponents().addSchemas(name, schema);
        setRequest(api.getPaths().get(path).getPost(), name);
    }

    private void healthContracts(OpenAPI api) {
        String base = "/api/v1/saude";
        optionalRequest(api, base + "/habilitacoes", "HealthGrantCreateRequest", new ObjectSchema()
                .addProperty("accountId", uuid(false))
                .addProperty("profession", new StringSchema()._enum(List.of("MEDICINA", "ENFERMAGEM", "PSICOLOGIA")))
                .addProperty("registrationNumber", text(1, 100, false))
                .addProperty("registrationRegion", new StringSchema().minLength(2).maxLength(2)
                        .pattern("^[A-Za-z]{2}$")._enum(List.of("AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES",
                                "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS",
                                "RO", "RR", "SC", "SP", "SE", "TO"))
                        .description("UF do registro; normalizada para maiúsculas no servidor."))
                .addProperty("verificationReason", text(10, 500, false))
                .required(List.of("accountId", "profession", "registrationNumber", "registrationRegion", "verificationReason")));
        optionalRequest(api, base + "/habilitacoes/{id}/revogacao", "HealthGrantEndRequest", reasonAndVersion());
        optionalRequest(api, base + "/vinculos", "HealthCareCreateRequest", new ObjectSchema()
                .addProperty("residentId", uuid(false)).addProperty("professionalGrantId", uuid(false))
                .addProperty("reason", text(10, 500, false))
                .required(List.of("residentId", "professionalGrantId", "reason")));
        optionalRequest(api, base + "/vinculos/{id}/encerramento", "HealthCareEndRequest", reasonAndVersion());
        optionalRequest(api, base + "/custodias", "HealthCustodyCreateRequest", new ObjectSchema()
                .addProperty("residentId", uuid(false)).addProperty("sourceAuthorAccountId", uuid(false))
                .addProperty("recipientGrantId", uuid(false)).addProperty("reason", text(10, 500, false))
                .required(List.of("residentId", "sourceAuthorAccountId", "recipientGrantId", "reason")));
        optionalRequest(api, base + "/custodias/{id}/encerramento", "HealthCustodyEndRequest", reasonAndVersion());
        optionalRequest(api, base + "/residentes/{id}/notas", "HealthNoteCreateRequest", new ObjectSchema()
                .addProperty("category", new StringSchema()._enum(List.of("GENERAL", "PSYCHOLOGICAL", "SHARED_SUMMARY")))
                .addProperty("body", text(1, 4000, false).description("Texto simples após trim; markup HTML recusado."))
                .addProperty("relatedNoteId", uuid(true)).required(List.of("category", "body")));
        optionalRequest(api, base + "/notas/{id}/correcoes", "HealthNoteCorrectionRequest", reasonAndVersion()
                .addProperty("body", text(1, 4000, false)).required(List.of("version", "reason", "body")));
        optionalRequest(api, base + "/notas/{id}/partilhas", "HealthNoteShareRequest", new ObjectSchema()
                .addProperty("version", version()).addProperty("recipientGrantIds", new ArraySchema()
                        .items(uuid(false)).minItems(1).maxItems(100).uniqueItems(true))
                .required(List.of("version", "recipientGrantIds")));
        optionalRequest(api, base + "/notas/{id}/partilhas/{shareId}/revogacao", "HealthShareEndRequest",
                new ObjectSchema().addProperty("version", version()).required(List.of("version")));
        api.getPaths().forEach((path, item) -> {
            if (path.startsWith(base) || path.startsWith("/api/v1/minha-saude")) {
                item.readOperations().forEach(operation -> operation.setDescription(
                        "A sessão e as permissões vigentes são verificadas no servidor em cada requisição. "
                        + "Administração de habilitações não concede acesso ao conteúdo. "
                        + "Leitura de conteúdo e exportação registram auditoria na mesma transação; "
                        + "acesso a uma nota indisponível responde 404. Respostas usam Cache-Control: no-store."));
            }
        });
    }

    private Schema<?> reasonAndVersion() {
        return new ObjectSchema().addProperty("version", version())
                .addProperty("reason", text(10, 500, false)).required(List.of("version", "reason"));
    }

    private void optionalRequest(OpenAPI api, String path, String name, Schema<?> schema) {
        PathItem item = api.getPaths().get(path);
        if (item != null && item.getPost() != null) {
            api.getComponents().addSchemas(name, schema);
            setRequest(item.getPost(), name);
        }
    }

    private void setRequest(Operation operation, String name) {
        operation.setRequestBody(new RequestBody().required(true).content(new Content()
                .addMediaType("application/json", new MediaType().schema(new Schema<>()
                        .$ref("#/components/schemas/" + name)))));
    }

    private Schema<?> text(int min, int max, boolean nullable) {
        return new StringSchema().minLength(min).maxLength(max).nullable(nullable);
    }

    private Schema<?> uuid(boolean nullable) {
        return new StringSchema().format("uuid").nullable(nullable);
    }

    private Schema<?> version() {
        return new IntegerSchema().format("int64").minimum(BigDecimal.ZERO)
                .maximum(BigDecimal.valueOf(Long.MAX_VALUE - 1));
    }
}
