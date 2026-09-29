package br.edu.ifgoiano.sager.management.rooms;

import java.util.List;

import br.edu.ifgoiano.sager.management.accommodations.Accommodation;
import br.edu.ifgoiano.sager.management.accommodations.AccommodationUnit;

public record RoomMap(List<Accommodation> accommodations, List<AccommodationUnit> units,
        List<RoomRecord> rooms) {
}
