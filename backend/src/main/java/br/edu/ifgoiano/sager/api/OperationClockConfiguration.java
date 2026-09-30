package br.edu.ifgoiano.sager.api;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@Profile({ "local", "production" })
@EnableScheduling
public class OperationClockConfiguration {
    @Bean
    Clock appClock() {
        return Clock.systemUTC();
    }
}
