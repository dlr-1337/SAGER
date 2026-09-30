package br.edu.ifgoiano.sager.integrations;

public interface WhatsAppProvider {
    boolean available();

    String send(String recipient, String rawToken);
}
