package br.edu.ifgoiano.sager.integrations;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

final class ProviderHttp {
    private final HttpClient client;
    private final ObjectMapper json;
    private final Duration timeout;
    private final String apiKey;

    ProviderHttp(HttpClient client, ObjectMapper json, Duration timeout, String apiKey) {
        this.client = client;
        this.json = json;
        this.timeout = timeout;
        this.apiKey = apiKey;
    }

    JsonNode json(URI uri, String method, Object body) {
        byte[] response =
                bytes(
                        uri,
                        method,
                        "application/json",
                        body == null ? null : "application/json",
                        body == null ? null : json.writeValueAsBytes(body),
                        2 * 1024 * 1024);
        try {
            return json.readTree(response);
        } catch (RuntimeException error) {
            throw failure(method, "provider_response_invalid");
        }
    }

    byte[] bytes(
            URI uri, String method, String accept, String contentType, byte[] body, int maximum) {
        HttpRequest.Builder builder =
                HttpRequest.newBuilder(uri)
                        .timeout(timeout)
                        .header("Accept", accept)
                        .header("X-Api-Key", apiKey);
        if (contentType != null) builder.header("Content-Type", contentType);
        builder.method(
                method,
                body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofByteArray(body));
        long began = System.nanoTime();
        try {
            HttpResponse<InputStream> response =
                    client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream input = response.body()) {
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    if (response.statusCode() == 429)
                        throw new ProviderFailure(
                                ProviderFailure.Kind.RETRYABLE, "provider_rate_limited");
                    if (response.statusCode() >= 500 || response.statusCode() == 408)
                        throw failure(method, "provider_http_temporary");
                    if (response.statusCode() == 404)
                        throw new ProviderFailure(
                                ProviderFailure.Kind.PERMANENT, "provider_not_found");
                    if (response.statusCode() == 401 || response.statusCode() == 403)
                        throw new ProviderFailure(
                                ProviderFailure.Kind.PERMANENT, "provider_unauthorized");
                    throw new ProviderFailure(
                            ProviderFailure.Kind.PERMANENT,
                            "provider_http_rejected",
                            response.statusCode());
                }
                FutureTask<byte[]> read = new FutureTask<>(() -> input.readNBytes(maximum + 1));
                Thread.ofVirtual().start(read);
                byte[] value;
                try {
                    long remaining = Math.max(1, timeout.toNanos() - (System.nanoTime() - began));
                    value = read.get(remaining, TimeUnit.NANOSECONDS);
                } catch (TimeoutException error) {
                    read.cancel(true);
                    throw failure(method, "provider_read_timeout");
                } catch (ExecutionException error) {
                    throw failure(method, "provider_read_failure");
                }
                if (value.length > maximum)
                    throw new ProviderFailure(
                            ProviderFailure.Kind.PERMANENT, "provider_body_too_large");
                return value;
            }
        } catch (HttpConnectTimeoutException | ConnectException error) {
            throw new ProviderFailure(ProviderFailure.Kind.RETRYABLE, "provider_connect_failure");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw failure(method, "provider_interrupted");
        } catch (IOException error) {
            throw failure(method, "provider_transport_failure");
        }
    }

    static ProviderFailure failure(String method, String code) {
        return new ProviderFailure(
                "POST".equals(method)
                        ? ProviderFailure.Kind.UNCERTAIN
                        : ProviderFailure.Kind.RETRYABLE,
                code);
    }

    static ProviderFailure invalid() {
        return new ProviderFailure(ProviderFailure.Kind.PERMANENT, "provider_response_invalid");
    }

    static URI append(URI root, String suffix) {
        return URI.create(root.toString().replaceAll("/$", "") + suffix);
    }

    static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isString() || value.asString().isBlank()) throw invalid();
        return value.asString();
    }
}
