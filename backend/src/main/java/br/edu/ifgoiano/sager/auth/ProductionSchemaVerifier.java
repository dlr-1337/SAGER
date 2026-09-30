package br.edu.ifgoiano.sager.auth;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;

@Component
@Profile("production")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ProductionSchemaVerifier implements ApplicationRunner {
    private final DataSource source;
    public ProductionSchemaVerifier(DataSource source) { this.source = source; }

    @Override
    public void run(ApplicationArguments arguments) {
        Flyway flyway = Flyway.configure().dataSource(source).locations("classpath:db/migration")
                .cleanDisabled(true).validateMigrationNaming(true).load();
        if (!flyway.validateWithResult().validationSuccessful || flyway.info().pending().length != 0)
            throw new IllegalStateException("Production schema is not ready; use the isolated migration command.");
        var jdbc = new JdbcTemplate(source);
        Boolean privileged = jdbc.queryForObject("""
                SELECT r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
                    OR pg_has_role(current_user,'sager_owner','MEMBER')
                    OR has_schema_privilege(current_user,'public','CREATE')
                    OR has_table_privilege(current_user,'sager_audit_event','UPDATE')
                    OR has_table_privilege(current_user,'sager_audit_event','DELETE')
                    OR has_table_privilege(current_user,'sager_audit_event','TRUNCATE')
                    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                        WHERE n.nspname='public' AND c.relowner=r.oid)
                FROM pg_roles r WHERE r.rolname=current_user
                """, Boolean.class);
        if (!Boolean.FALSE.equals(privileged))
            throw new IllegalStateException("Production runtime role has unexpected administrative privileges.");
    }
}
