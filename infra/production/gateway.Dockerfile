FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
COPY infra/production/mark-production.mjs ./mark-production.mjs
RUN npm run build
RUN node mark-production.mjs

FROM nginx:1.30.0-alpine@sha256:0272e4604ed93c1792f03695a033a6e8546840f86e0de20a884bb17d2c924883 AS gateway-runtime
COPY --from=build /build/dist/frontend/browser /usr/share/nginx/html
COPY infra/production/sager-proxy.conf /etc/nginx/sager-proxy.conf
COPY infra/production/sager-security-headers.conf /etc/nginx/sager-security-headers.conf
COPY infra/production/whatsapp-gateway-proxy.conf.template /etc/nginx/whatsapp-gateway-proxy.conf.template
USER 101:101

FROM gateway-runtime AS coolify
COPY infra/coolify/nginx.conf.template /etc/nginx/nginx.conf.template
COPY --chmod=0555 infra/coolify/start-gateway.sh /app/start-gateway.sh
EXPOSE 8080
ENTRYPOINT ["/app/start-gateway.sh"]

# Keep the TLS deployment as the default final target.
FROM gateway-runtime AS standalone
COPY infra/production/nginx.conf.template /etc/nginx/nginx.conf.template
COPY --chmod=0555 infra/production/start-gateway.sh /app/start-gateway.sh
EXPOSE 8080 8443
ENTRYPOINT ["/app/start-gateway.sh"]
