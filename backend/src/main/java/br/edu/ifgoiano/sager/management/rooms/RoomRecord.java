package br.edu.ifgoiano.sager.management.rooms;

import java.util.UUID;

public record RoomRecord(UUID id, String code, String number, UUID accommodationId, UUID unitId,
        String floor, Integer capacity, String situation, Integer occupancy, Integer vacancies,
        long version) {
}
