package br.edu.ifgoiano.sager.auth;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

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
            LocalAccountAuthenticationProvider provider, LocalAccountStatusFilter accountStatusFilter)
            throws Exception {
        requireLoopbackOnly(environment);
        http.authorizeHttpRequests(requests -> requests
                        .requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login", "/error")
                        .permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/logout")
                        .authenticated()
                        .requestMatchers("/api/v1/supervisores", "/api/v1/supervisores/**")
                        .hasRole("GESTOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/alojamentos", "/api/v1/alojamentos/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/alojamentos", "/api/v1/alojamentos/**")
                        .hasRole("GESTOR")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/alojamentos/**")
                        .hasRole("GESTOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/quartos", "/api/v1/quartos/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/quartos")
                        .hasRole("GESTOR")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/quartos/**")
                        .hasRole("GESTOR")
                        .requestMatchers(HttpMethod.GET, "/api/v1/residentes", "/api/v1/residentes/**")
                        .hasAnyRole("GESTOR", "SUPERVISOR")
                        .requestMatchers(HttpMethod.POST, "/api/v1/residentes")
                        .hasRole("GESTOR")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/residentes/**")
                        .hasRole("GESTOR")
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
                            response.setHeader("Cache-Control", "no-store");
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                        }))
                .logout(logout -> logout.logoutUrl("/api/v1/auth/logout")
                        .logoutSuccessHandler((request, response, authentication) -> {
                            response.setHeader("Cache-Control", "no-store");
                            response.setStatus(HttpStatus.NO_CONTENT.value());
                        }))
                .sessionManagement(session -> session.sessionFixation(fixation ->
                        fixation.changeSessionId()))
                .addFilterAfter(accountStatusFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, error) ->
                        response.sendError(HttpStatus.UNAUTHORIZED.value())))
                .csrf(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    @Profile("!local")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    SecurityFilterChain closedSecurityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(requests -> requests.anyRequest().denyAll())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
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
