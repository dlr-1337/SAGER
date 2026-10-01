# Package the maintenance helper; deployment checkouts are not runtime bind mounts.
FROM postgres:17.11-bookworm@sha256:639ab7ceb90e13123085b741fb31ef493fba25463002f6da665352e7b534b652
COPY --chmod=0555 infra/production/initialize-runtime.sh /opt/sager/initialize-runtime.sh
USER 10001:10001
ENTRYPOINT ["sh", "/opt/sager/initialize-runtime.sh"]
