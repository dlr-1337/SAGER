# Tech Stack

## Frontend

- Angular 22.2 standalone application
- TypeScript 6.0.2, RxJS 7.8
- Angular Material/CDK 22.2
- Vitest 5 with JSDOM for unit tests
- Playwright 1.63 and axe-core for browser tests
- Chart.js 4.5, Open Sans and Material Symbols

## Backend

- Java 21
- Spring Boot 4.1.1
- Spring MVC, Security, JDBC, JDBC Session and Actuator
- Flyway with PostgreSQL database support
- PostgreSQL JDBC driver
- Springdoc OpenAPI 3.1.1
- Apache POI 5.5.1 and PDFBox 3.0.8
- Testcontainers PostgreSQL 2.0.5

## Persistence and wiring

The backend uses `JdbcTemplate` and SQL migrations, not JPA entities. Security
uses Spring Security with local accounts and JDBC sessions. Scheduled workers
claim database jobs with leases and `SKIP LOCKED`.

## Existing cleanup constraints

- Angular lazy routes and standalone imports make feature-level extraction safe,
  but public route paths and test selectors are compatibility contracts.
- Flyway migrations already applied must not be rewritten or deleted.
- Database denormalized snapshot fields and immutable histories are behavioral
  requirements, not ordinary duplication.
- Integration and health data have distinct authorization and retention semantics.

