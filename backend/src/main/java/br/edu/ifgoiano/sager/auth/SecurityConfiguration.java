package br.edu.ifgoiano.sager.auth;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SecurityConfiguration {
    @Bean
    CookieSerializer cookieSerializer() {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setUseSecureCookie(true);
        serializer.setUseHttpOnlyCookie(true);
        serializer.setSameSite("Lax");
        return serializer;
    }

    @Bean
    InstitutionalOidcUserService institutionalOidcUserService(IdentityRepository identities,
            @Value("${sager.auth.allowed-hd:}") String allowedHostedDomains) {
        return new InstitutionalOidcUserService(identities, allowedHostedDomains);
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
            InstitutionalOidcUserService institutionalUserService) throws Exception {
        http.authorizeHttpRequests(requests -> requests
                        .requestMatchers("/", "/index.html", "/error", "/api/v1/auth/csrf",
                                "/oauth2/authorization/google", "/login/oauth2/code/google")
                        .permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/logout").authenticated()
                        .anyRequest().denyAll())
                .oauth2Login(login -> login
                        .userInfoEndpoint(userInfo -> userInfo.oidcUserService(institutionalUserService))
                        .defaultSuccessUrl("/api/v1/auth/me", true)
                        .failureHandler(loginFailureHandler()))
                .logout(logout -> logout.logoutUrl("/api/v1/auth/logout")
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpStatus.NO_CONTENT.value())))
                .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, error) ->
                        response.sendError(HttpStatus.UNAUTHORIZED.value())))
                .csrf(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable);
        return http.build();
    }

    private AuthenticationFailureHandler loginFailureHandler() {
        return (request, response, exception) -> {
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("text/html;charset=UTF-8");
            response.setHeader("Cache-Control", "no-store");
            if (exception instanceof PendingProfileException pending) {
                writePage(response, "Perfil local pendente",
                        "Informe este código ao operador autorizado: " + pending.requestId());
            } else {
                writePage(response, "Acesso não autorizado",
                        "Esta conta não recebeu acesso ao SAGER. Procure a equipe responsável.");
            }
        };
    }

    private void writePage(HttpServletResponse response, String title, String message)
            throws IOException {
        response.getWriter().write("""
                <!doctype html><html lang="pt-BR"><meta charset="utf-8">
                <title>%s</title><main><h1>%s</h1><p>%s</p>
                <p><a href="/">Voltar</a></p></main></html>
                """.formatted(title, title, message));
    }
}
