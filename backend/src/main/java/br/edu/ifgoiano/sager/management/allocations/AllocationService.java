package br.edu.ifgoiano.sager.management.allocations;

import java.sql.SQLException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import br.edu.ifgoiano.sager.audit.AuditAction;
import br.edu.ifgoiano.sager.audit.AuditResource;
import br.edu.ifgoiano.sager.audit.AuditService;
import br.edu.ifgoiano.sager.management.FieldRules;
import br.edu.ifgoiano.sager.management.rooms.RoomRecord;
import br.edu.ifgoiano.sager.management.rooms.RoomRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({ "local", "production" })
public class AllocationService {
    private final AllocationRepository allocations;
    private final RoomRepository rooms;
    private final AuditService audit;
    private final Clock clock;

    public AllocationService(AllocationRepository allocations, RoomRepository rooms, AuditService audit,
            Clock clock) {
        this.allocations = allocations;
        this.rooms = rooms;
        this.audit = audit;
        this.clock = clock;
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
        checkAdmission(residentId, room);
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
        checkAdmission(current.residentId(), target);
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

    /**
     * Rotina diária: encerra o vínculo de quem passou da saída prevista. A condição é "passou",
     * não "venceu ontem", então um dia sem execução é recuperado no seguinte.
     */
    @Transactional
    public int closeConcluded() {
        LocalDate today = today();
        UUID requestId = UUID.randomUUID();
        int closed = 0;
        for (AllocationRepository.CourseFacts due : allocations.activeCourseFacts()) {
            if (!due.concluded(today)) continue;
            allocations.lockResident(due.residentId());
            Allocation current = allocations.findByIdForUpdate(due.allocationId()).orElse(null);
            if (current == null || current.endedAt() != null || !concluded(due.residentId(), today)) continue;
            Allocation ended = allocations.close(current.id(), current.version(), "CONCLUSION");
            if (ended == null) continue;
            audit.recordSystem(requestId, AuditResource.ALLOCATION, ended.id(), AuditAction.END, ended.version(),
                    Set.of("endedAt", "endReason"));
            closed++;
        }
        return closed;
    }

    private boolean concluded(UUID residentId, LocalDate today) {
        return allocations.courseFacts(residentId).map(facts -> facts.concluded(today)).orElse(false);
    }

    /** Data civil de hoje pelo relógio do servidor (cap4.tex:218). */
    private LocalDate today() {
        return LocalDate.now(clock.withZone(ZoneId.of("America/Sao_Paulo")));
    }

    private Allocation locked(UUID id) {
        return allocations.findByIdForUpdate(id).orElseThrow(() -> new AllocationApiException(
                HttpStatus.NOT_FOUND, "not_found", "Alocação não encontrada."));
    }

    private RoomRecord lockRoom(UUID id) {
        return rooms.findByIdForUpdate(id).orElseThrow(() -> invalidReference("Quarto não encontrado."));
    }

    private void checkAdmission(UUID residentId, RoomRecord room) {
        if (concluded(residentId, today())) {
            throw conflict("resident_concluded",
                    "Este residente concluiu o curso. Lance a prorrogação antes de colocar no quarto.");
        }
        AllocationRepository.AgeCheck age = allocations.ageCheck(residentId, room.id());
        if (age.ageGroup() != null && age.birthDate() == null) {
            throw conflict("birth_date_required",
                    "Informe a data de nascimento do residente antes de colocá-lo neste quarto.");
        }
        if (age.ageGroup() != null
                && FieldRules.minor(age.birthDate(), clock.instant()) != age.ageGroup().equals("MENORES")) {
            throw conflict("age_group_mismatch",
                    "Este quarto é de outra faixa etária. Escolha um quarto da faixa do residente.");
        }
        // Before the situation: a room without capacity shows as Indisponível, and the refusal
        // must still ask for the capacity.
        if (room.capacity() == null) {
            throw conflict("capacity_unknown", "Defina a capacidade antes de alocar residentes.");
        }
        if (room.situation().equals("Manutenção") || room.situation().equals("Indisponível")) {
            throw conflict("room_unavailable", "O quarto não recebe novas alocações nesta situação.");
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
