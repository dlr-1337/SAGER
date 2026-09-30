package br.edu.ifgoiano.sager.management.allocations;

import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.management.rooms.RoomRecord;
import br.edu.ifgoiano.sager.management.rooms.RoomRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("local")
public class AllocationService {
    private final AllocationRepository allocations;
    private final RoomRepository rooms;
    private final AuditService audit;

    public AllocationService(AllocationRepository allocations, RoomRepository rooms, AuditService audit) {
        this.allocations = allocations;
        this.rooms = rooms;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<Allocation> list(UUID residentId, UUID roomId, Boolean active) {
        if ((residentId == null) == (roomId == null) || (residentId != null && active != null)) {
            throw invalidInput("Informe apenas residentId ou roomId; active vale somente para roomId.");
        }
        return residentId != null ? allocations.findByResident(residentId)
                : allocations.findByRoom(roomId, active);
    }

    @Transactional(readOnly = true)
    public Allocation get(UUID id) {
        return allocations.findById(id).orElseThrow(() -> new AllocationApiException(HttpStatus.NOT_FOUND,
                "not_found", "Alocação não encontrada."));
    }

    @Transactional
    public Allocation create(UUID residentId, UUID roomId) {
        requireIds(residentId, roomId);
        if (!allocations.lockResident(residentId)) {
            throw invalidReference("Residente não encontrado.");
        }
        RoomRecord room = lockRoom(roomId);
        if (allocations.activeResident(residentId)) {
            throw conflict("active_conflict", "O residente já possui uma alocação ativa.");
        }
        checkAdmission(room);
        Allocation created;
        try {
            created = allocations.insert(UUID.randomUUID(), residentId, roomId);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        audit.record(AuditResource.ALLOCATION, created.id(), AuditAction.CREATE, created.version(),
                Set.of("residentId", "roomId", "startedAt"));
        return created;
    }

    @Transactional
    public Allocation transfer(UUID allocationId, UUID targetRoomId, long version) {
        checkVersion(version);
        if (targetRoomId == null) {
            throw invalidInput("roomId é obrigatório.");
        }
        Allocation original = get(allocationId);
        allocations.lockResident(original.residentId());
        Allocation current = locked(allocationId);
        checkOpenVersion(current, version);
        if (current.roomId().equals(targetRoomId)) {
            throw invalidInput("A transferência exige outro quarto.");
        }
        RoomRecord target = lockRoom(targetRoomId);
        checkAdmission(target);
        Allocation closed = allocations.close(allocationId, version, "TRANSFER");
        if (closed == null) {
            throw conflict("stale_version", "A alocação foi alterada. Recarregue o registro.");
        }
        Allocation created;
        try {
            created = allocations.insert(UUID.randomUUID(), current.residentId(), targetRoomId);
        } catch (DataIntegrityViolationException error) {
            throw integrityError(error);
        }
        audit.record(AuditResource.ALLOCATION, closed.id(), AuditAction.END, closed.version(),
                Set.of("endedAt", "endReason"));
        audit.record(AuditResource.ALLOCATION, created.id(), AuditAction.CREATE, created.version(),
                Set.of("residentId", "roomId", "startedAt"));
        return created;
    }

    @Transactional
    public Allocation end(UUID allocationId, long version) {
        checkVersion(version);
        Allocation original = get(allocationId);
        allocations.lockResident(original.residentId());
        Allocation current = locked(allocationId);
        checkOpenVersion(current, version);
        Allocation closed = allocations.close(allocationId, version, "END");
        if (closed == null) {
            throw conflict("stale_version", "A alocação foi alterada. Recarregue o registro.");
        }
        audit.record(AuditResource.ALLOCATION, closed.id(), AuditAction.END, closed.version(),
                Set.of("endedAt", "endReason"));
        return closed;
    }

    private Allocation locked(UUID id) {
        return allocations.findByIdForUpdate(id).orElseThrow(() -> new AllocationApiException(
                HttpStatus.NOT_FOUND, "not_found", "Alocação não encontrada."));
    }

    private RoomRecord lockRoom(UUID id) {
        return rooms.findByIdForUpdate(id).orElseThrow(() -> invalidReference("Quarto não encontrado."));
    }

    private void checkAdmission(RoomRecord room) {
        if (room.situation().equals("Manutenção") || room.situation().equals("Indisponível")) {
            throw conflict("room_unavailable", "O quarto não recebe novas alocações nesta situação.");
        }
        if (room.capacity() == null) {
            throw conflict("capacity_unknown", "Defina a capacidade antes de alocar residentes.");
        }
        if (allocations.activeRoomCount(room.id()) >= room.capacity()) {
            throw conflict("room_full", "A capacidade do quarto foi atingida.");
        }
    }

    private void checkOpenVersion(Allocation current, long version) {
        if (current.version() != version || current.endedAt() != null) {
            throw conflict("stale_version", "A alocação foi alterada. Recarregue o registro.");
        }
    }

    private void requireIds(UUID residentId, UUID roomId) {
        if (residentId == null || roomId == null) {
            throw invalidInput("residentId e roomId são obrigatórios.");
        }
    }

    private void checkVersion(long version) {
        if (version < 0 || version == Long.MAX_VALUE) {
            throw invalidInput("version deve ser um inteiro não negativo válido.");
        }
    }

    private AllocationApiException invalidInput(String message) {
        return new AllocationApiException(HttpStatus.BAD_REQUEST, "invalid_input", message);
    }

    private AllocationApiException invalidReference(String message) {
        return new AllocationApiException(HttpStatus.UNPROCESSABLE_CONTENT, "invalid_reference", message);
    }

    private AllocationApiException conflict(String code, String message) {
        return new AllocationApiException(HttpStatus.CONFLICT, code, message);
    }

    private RuntimeException integrityError(DataIntegrityViolationException error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) {
                if ("23505".equals(sql.getSQLState())) {
                    return conflict("active_conflict", "O residente já possui uma alocação ativa.");
                }
                if ("23503".equals(sql.getSQLState())) {
                    return invalidReference("Residente ou quarto não encontrado.");
                }
            }
        }
        return error;
    }
}
