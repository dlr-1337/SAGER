package br.edu.ifgoiano.sager.auth;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

import br.edu.ifgoiano.sager.api.ApiErrors;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SecurityConfiguration {
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    CookieSerializer cookieSerializer(Environment environment) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setUseSecureCookie(!Arrays.asList(environment.getActiveProfiles()).contains("local"));
        serializer.setUseHttpOnlyCookie(true);
        serializer.setSameSite("Lax");
        return serializer;
    }

    @Bean
    @Profile("local")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    FilterRegistrationBean<LocalAccountStatusFilter> accountStatusFilterRegistration(
            LocalAccountStatusFilter filter) {
        FilterRegistrationBean<LocalAccountStatusFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    @Profile("local")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    SecurityFilterChain localSecurityFilterChain(HttpSecurity http, Environment environment,
            LocalAccountAuthenticationProvider provider, LocalAccountStatusFilter accountStatusFilter,
            ApiErrors apiErrors)
            throws Exception {
        requireLoopbackOnly(environment);
        http.authorizeHttpRequests(requests -> requests
                        .requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login", "/error")
                        .permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/logout")
                        .authenticated()
                        .requestMatchers("/api/v1/ocorrencias", "/api/v1/ocorrencias/**",
                                "/api/v1/notificacoes", "/api/v1/notificacoes/**",
                                "/api/v1/advertencias", "/api/v1/advertencias/**",
                                "/api/v1/avisos", "/api/v1/avisos/**", "/api/v1/termos", "/api/v1/termos/**",
                                "/api/v1/residentes/*/reincidencias", "/api/v1/residentes/*/termos")
                        .hasRole("SUPERVISOR")
                        .requestMatchers("/api/v1/me/avisos", "/api/v1/me/advertencias", "/api/v1/me/termos",
                                "/api/v1/me/termos/**",
                                "/api/v1/me/comunicacoes", "/api/v1/me/comunicacoes/**")
                        .hasRole("RESIDENTE")
                        .requestMatchers("/api/v1/chamadas", "/api/v1/chamadas/**")
                        .hasRole("SUPERVISOR")
                        .requestMatchers("/api/v1/saidas-curtas", "/api/v1/saidas-curtas/**")
                        .hasAnyRole("SUPERVISOR", "RESIDENTE")
                        .requestMatchers("/api/v1/saude/**", "/api/v1/minha-saude/**")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auditoria", "/api/v1/openapi",
                                "/api/v1/openapi.yaml", "/actuator/health", "/actuator/metrics",
                                "/actuator/metrics/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers("/api/v1/supervisores", "/api/v1/supervisores/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/alojamentos", "/api/v1/alojamentos/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/alojamentos", "/api/v1/alojamentos/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/alojamentos/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/quartos", "/api/v1/quartos/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/quartos")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/quartos/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/residentes", "/api/v1/residentes/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/residentes")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/residentes/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/responsaveis", "/api/v1/responsaveis/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/responsaveis")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/responsaveis/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/alocacoes", "/api/v1/alocacoes/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/alocacoes", "/api/v1/alocacoes/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .anyRequest().denyAll())
                .authenticationProvider(provider)
                .formLogin(login -> login.loginPage("/api/v1/auth/login")
                        .loginProcessingUrl("/api/v1/auth/login")
                        .usernameParameter("email")
                        .passwordParameter("password")
                        .successHandler((request, response, authentication) -> {
                            response.setHeader("Cache-Control", "no-store");
                            response.setStatus(HttpStatus.NO_CONTENT.value());
                        })
                        .failureHandler((request, response, exception) -> {
                            apiErrors.write(request, response, 401, "invalid_credentials",
                                    "E-mail ou senha inválidos.");
                        }))
                .logout(logout -> logout.logoutUrl("/api/v1/auth/logout")
                        .logoutSuccessHandler((request, response, authentication) -> {
                            response.setHeader("Cache-Control", "no-store");
                            response.setStatus(HttpStatus.NO_CONTENT.value());
                        }))
                .sessionManagement(session -> session.sessionFixation(fixation ->
                        fixation.changeSessionId()))
                .addFilterAfter(accountStatusFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) ->
                                apiErrors.write(request, response, 401, "unauthorized", ApiErrors.message(401)))
                        .accessDeniedHandler((request, response, error) -> {
                            boolean csrf = error instanceof CsrfException;
                            apiErrors.write(request, response, 403, csrf ? "csrf_invalid" : "forbidden",
                                    csrf ? "Proteção da sessão inválida. Recarregue a página e tente novamente."
                                            : ApiErrors.message(403));
                        }))
                .csrf(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    @Profile("!local")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    SecurityFilterChain closedSecurityFilterChain(HttpSecurity http, ApiErrors apiErrors) throws Exception {
        http.authorizeHttpRequests(requests -> requests.anyRequest().denyAll())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) ->
                                apiErrors.write(request, response, 401, "unauthorized", ApiErrors.message(401)))
                        .accessDeniedHandler((request, response, error) ->
                                apiErrors.write(request, response, 403, "forbidden", ApiErrors.message(403))))
                .csrf(Customizer.withDefaults());
        return http.build();
    }

    static void requireLoopbackOnly(Environment environment) {
        if (!Arrays.equals(environment.getActiveProfiles(), new String[] { "local" })) {
            throw new IllegalStateException("O login local exige somente o perfil 'local'.");
        }
        String address = environment.getProperty("server.address", "");
        if (address.isBlank()) {
            throw new IllegalStateException("O login local exige server.address de loopback.");
        }
        try {
            if (!InetAddress.getByName(address).isLoopbackAddress()) {
                throw new IllegalStateException("O login local exige server.address de loopback.");
            }
        } catch (UnknownHostException error) {
            throw new IllegalStateException("server.address invalido para login local.", error);
        }
    }
}
