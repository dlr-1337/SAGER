package br.edu.ifgoiano.sager.management.courses;
import java.util.UUID;
public record Course(UUID id, String name, boolean active, long version) {}
