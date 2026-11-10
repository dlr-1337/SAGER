package br.edu.ifgoiano.sager.conversations;

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

import java.util.List;

@Configuration
@Profile({ "local", "production" })
public class ConversationOpenApiConfiguration {
    private static final String BASE = "/api/v1/conversas";

    @Bean
    OpenApiCustomizer conversationContracts() {
        return api -> {
            api.getPaths()
                    .forEach(
                            (path, item) -> {
                                if (path.startsWith(BASE))
                                    item.readOperations()
                                            .forEach(
                                                    operation ->
                                                            operation.setDescription(
                                                                    "Conversas de WhatsApp: exclusivo do supervisor, inclusive arquivos."
                                                                        + " Envio exige Idempotency-Key; a auditoria"
                                                                        + " guarda metadados, nunca o conteúdo."));
                            });
            for (String path : List.of(BASE + "/mensagens/{id}/midia", BASE + "/sessao/qr"))
                api.getPaths()
                        .get(path)
                        .getGet()
                        .getResponses()
                        .addApiResponse(
                                "200",
                                new ApiResponse()
                                        .description("Arquivo privado; resposta sem cache e com nosniff.")
                                        .content(
                                                new Content()
                                                        .addMediaType(
                                                                "application/octet-stream",
                                                                new MediaType()
                                                                        .schema(
                                                                                new StringSchema()
                                                                                        .format(
                                                                                                "binary")))));
            var start =
                    new ObjectSchema()
                            .addProperty("guardianId", new StringSchema().format("uuid"))
                            .required(List.of("guardianId"));
            var link =
                    new ObjectSchema()
                            .addProperty("exitId", new StringSchema().format("uuid"))
                            .addProperty("version", new IntegerSchema().format("int64"))
                            .required(List.of("exitId", "version"));
            var text =
                    new ObjectSchema()
                            .addProperty("text", new StringSchema().minLength(1).maxLength(4096))
                            .required(List.of("text"));
            var file =
                    new ObjectSchema()
                            .addProperty("file", new StringSchema().format("binary"))
                            .addProperty("text", new StringSchema().maxLength(1024))
                            .required(List.of("file"));
            api.getPaths().get(BASE).getPost().setRequestBody(json(api, "ConversationStartRequest", start));
            api.getPaths()
                    .get(BASE + "/mensagens/{id}/vinculo")
                    .getPost()
                    .setRequestBody(json(api, "ConversationLinkRequest", link));
            var send = json(api, "ConversationTextRequest", text);
            api.getComponents().addSchemas("ConversationFileRequest", file);
            send.getContent()
                    .addMediaType(
                            "multipart/form-data",
                            new MediaType()
                                    .schema(
                                            new Schema<>()
                                                    .$ref(
                                                            "#/components/schemas/ConversationFileRequest")));
            api.getPaths().get(BASE + "/{id}/mensagens").getPost().setRequestBody(send);
        };
    }

    private RequestBody json(io.swagger.v3.oas.models.OpenAPI api, String name, Schema<?> schema) {
        schema.setAdditionalProperties(false);
        api.getComponents().addSchemas(name, schema);
        return new RequestBody()
                .required(true)
                .content(
                        new Content()
                                .addMediaType(
                                        "application/json",
                                        new MediaType()
                                                .schema(
                                                        new Schema<>()
                                                                .$ref("#/components/schemas/" + name))));
    }
}
