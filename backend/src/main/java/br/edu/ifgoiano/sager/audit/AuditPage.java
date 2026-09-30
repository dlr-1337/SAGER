package br.edu.ifgoiano.sager.audit;

import java.util.List;

public record AuditPage(List<AuditEvent> items, Long nextCursor) {
    public AuditPage {
        items = List.copyOf(items);
    }
}
