package br.edu.ifgoiano.sager.auth;

import java.util.Arrays;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration
@Profile("production")
public class ProductionModeGuard {
    @Bean
    static BeanFactoryPostProcessor validateProductionBeforeDatabaseInitialization(Environment environment) {
        return factory -> requireProduction(environment);
    }

    public static void requireProduction(Environment environment) {
        if (!Arrays.equals(environment.getActiveProfiles(), new String[] { "production" }))
            throw new IllegalStateException("Production requires only the production profile.");
        require("framework".equals(environment.getProperty("server.forward-headers-strategy")), "trusted proxy configuration");
        require(environment.getProperty("server.servlet.session.cookie.secure", Boolean.class, false), "secure session cookies");
        require(!environment.getProperty("spring.flyway.enabled", Boolean.class, true), "separate migration credentials");
        require(!environment.getProperty("springdoc.api-docs.enabled", Boolean.class, true), "private API documentation");
        require("sager_runtime".equals(environment.getProperty("spring.datasource.username")), "runtime database role");
        require(environment.getProperty("spring.datasource.password", "").length() >= 32, "database secret");
        require(environment.getProperty("sager.production.rate-limit-secret", "").length() >= 32, "login counter secret");
        String host = environment.getProperty("sager.production.public-host", "");
        require(host.length() <= 253 && host.matches("(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"), "public hostname");
    }

    private static void require(boolean condition, String requirement) {
        if (!condition) throw new IllegalStateException("Production requires " + requirement + ".");
    }
}
