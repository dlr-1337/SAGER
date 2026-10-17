package br.edu.ifgoiano.sager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class EnrollmentCatalogMigrationIntegrationTest {
    private static final PostgreSQLContainer POSTGRES=new PostgreSQLContainer("postgres:17.11");
    static { POSTGRES.start(); }
    @Test void upgradesLegacyRowsWithoutReplacingAccountsOrGuessingEnrollment() {
        String schema="catalog_upgrade"; migrate(schema,"9"); var jdbc=jdbc(schema);
        UUID resident=UUID.randomUUID(); UUID second=UUID.randomUUID(); UUID account=UUID.randomUUID(); UUID unlinked=UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident(id,name,enrollment,course) VALUES (?,?,?,?)",resident,"Residente Legado","000123","Curso   Técnico");
        jdbc.update("INSERT INTO sager_resident(id,name,enrollment,course) VALUES (?,?,?,?)",second,"Outra Pessoa Legada","000124","curso técnico");
        migrate(schema,"19");
        jdbc.update("INSERT INTO sager_local_account(id,email,display_name,password_hash,profile,resident_id) VALUES (?,?,?,'synthetic-hash','residente',?)",account,"legacy@example.invalid","Conta Legada",resident);
        jdbc.update("INSERT INTO sager_local_account(id,email,display_name,password_hash,profile) VALUES (?,?,?,'synthetic-hash','gestor')",unlinked,"staff@example.invalid","Equipe Legada");
        migrate(schema,"21");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sager_course",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(DISTINCT course_id) FROM sager_resident",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT enrollment FROM sager_local_account WHERE id=?",String.class,account)).isEqualTo("000123");
        assertThat(jdbc.queryForObject("SELECT enrollment FROM sager_local_account WHERE id=?",String.class,unlinked)).isNull();
        assertThat(jdbc.queryForObject("SELECT password_hash FROM sager_local_account WHERE id=?",String.class,account)).isEqualTo("synthetic-hash");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sager_resident WHERE birth_date IS NULL",Integer.class)).isEqualTo(2);
        assertThatThrownBy(()->jdbc.update("UPDATE sager_resident SET name='Ainda sem nascimento' WHERE id=?",resident)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT sager_search_text('  João Ávila  ')",String.class)).isEqualTo("joao avila");
    }
    @Test void leavesCrossProfileEnrollmentCollisionsForExplicitOperatorMapping() {
        String schema="enrollment_collision";migrate(schema,"19");var jdbc=jdbc(schema);
        UUID resident=UUID.randomUUID();UUID supervisor=UUID.randomUUID();
        jdbc.update("INSERT INTO sager_resident(id,name,enrollment,birth_date) VALUES (?,?,?,'2000-01-01')",resident,"Pessoa Sintética","00077");
        jdbc.update("INSERT INTO sager_supervisor(id,name,institutional_id,email) VALUES (?,?,?,?)",supervisor,"Equipe Sintética","00077","staff@example.invalid");
        jdbc.update("INSERT INTO sager_local_account(id,email,display_name,password_hash,profile,resident_id) VALUES (?,?,'Residente','synthetic','residente',?)",UUID.randomUUID(),"r@example.invalid",resident);
        jdbc.update("INSERT INTO sager_local_account(id,email,display_name,password_hash,profile,supervisor_id) VALUES (?,?,'Supervisor','synthetic','supervisor',?)",UUID.randomUUID(),"s@example.invalid",supervisor);
        migrate(schema,"21");assertThat(jdbc.queryForObject("SELECT count(*) FROM sager_local_account WHERE enrollment IS NULL",Integer.class)).isEqualTo(2);
    }
    private void migrate(String schema,String target) { Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").target(target).load().migrate(); }
    private JdbcTemplate jdbc(String schema) { return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl()+(POSTGRES.getJdbcUrl().contains("?")?"&":"?")+"currentSchema="+schema,POSTGRES.getUsername(),POSTGRES.getPassword())); }
}
