# Digests verified against the official registry on 2026-09-30.
FROM eclipse-temurin:21.0.12.1_1-jdk-jammy@sha256:6adefddd4a20bceef702cedb0b03952fcd7691f9c7ccffe27014992abc0b46bd AS build
WORKDIR /build
COPY backend/.mvn .mvn
COPY --chmod=0555 backend/mvnw mvnw
COPY backend/pom.xml pom.xml
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp dependency:go-offline
COPY backend/src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp -DskipTests package

FROM eclipse-temurin:21.0.12.1_1-jre-jammy@sha256:e9aaf73145bbd1f9f6ec7f6867dd75a44f34b1a6c32a813504bf4129be2d09d7
RUN groupadd --gid 10001 sager && useradd --uid 10001 --gid sager --no-create-home sager \
    && mkdir -p /app /data/documents /data/reports \
    && chown -R 10001:10001 /app /data
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/target/sager-backend-0.1.0-SNAPSHOT.jar app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65", "-XX:+ExitOnOutOfMemoryError", "-Djava.io.tmpdir=/tmp", "-jar", "/app/app.jar"]
