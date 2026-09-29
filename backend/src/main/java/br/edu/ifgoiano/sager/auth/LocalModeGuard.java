package br.edu.ifgoiano.sager.auth;

import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
public class LocalModeGuard {
    public LocalModeGuard(Environment environment) {
        SecurityConfiguration.requireLoopbackOnly(environment);
    }
}
