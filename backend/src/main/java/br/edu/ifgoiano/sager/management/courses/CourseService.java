package br.edu.ifgoiano.sager.management.courses;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import br.edu.ifgoiano.sager.audit.*;
import br.edu.ifgoiano.sager.management.residents.ResidentApiException;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile({"local", "production"})
public class CourseService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    public CourseService(JdbcTemplate jdbc, AuditService audit) { this.jdbc = jdbc; this.audit = audit; }
    private static final String COLUMNS = "id,name,active,version,level,duration_years";
    private static final RowMapper<Course> ROW = (r,n) -> new Course(r.getObject("id", UUID.class), r.getString("name"),
            r.getBoolean("active"), r.getLong("version"), r.getString("level"), r.getObject("duration_years", Integer.class));
    public List<Course> list() {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_course ORDER BY lower(name),id", ROW);
    }
    public Course get(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM sager_course WHERE id=? FOR UPDATE", ROW, id)
                .stream().findFirst().orElseThrow(() -> error(HttpStatus.BAD_REQUEST, "invalid_input", "Curso não encontrado."));
    }
    public String selectedName(UUID id, UUID previousId) {
        if (id == null) return null;
        Course course = get(id);
        if (!course.active() && !id.equals(previousId)) throw error(HttpStatus.BAD_REQUEST, "invalid_input", "Escolha um curso ativo.");
        return course.name();
    }
    @Transactional
    public Course save(UUID id, String name, boolean active, Long version, String level, Integer durationYears) {
        if (name == null) throw error(HttpStatus.BAD_REQUEST, "invalid_input", "Informe o nome do curso.");
        if (level != null && !List.of("MEDIO", "SUPERIOR").contains(level))
            throw error(HttpStatus.BAD_REQUEST, "invalid_input", "Escolha o nível: ensino médio ou superior.");
        if (durationYears != null && (durationYears < 1 || durationYears > 6))
            throw error(HttpStatus.BAD_REQUEST, "invalid_input", "A duração deve ficar entre 1 e 6 anos.");
        String checked = name.strip().replaceAll("\\s+", " ");
        if (checked.isBlank() || checked.length() > 200 || checked.chars().anyMatch(Character::isISOControl))
            throw error(HttpStatus.BAD_REQUEST, "invalid_input", "Nome do curso inválido.");
        boolean creating = id == null;
        Course current = creating ? null : get(id);
        if (!creating && (version == null || version < 0 || version == Long.MAX_VALUE || current.version() != version))
            throw error(HttpStatus.CONFLICT, "stale_version", "O curso foi alterado. Recarregue a lista.");
        // Curso antigo sem nível ou duração só pode ser ativado ou desativado sem informá-los.
        if ((level == null || durationYears == null) && (creating || !current.name().equals(checked)
                || !Objects.equals(current.level(), level) || !Objects.equals(current.durationYears(), durationYears)))
            throw error(HttpStatus.BAD_REQUEST, "invalid_input", "Informe o nível e a duração do curso.");
        UUID savedId = creating ? UUID.randomUUID() : id;
        try {
            if (creating) jdbc.update("INSERT INTO sager_course(id,name,active,level,duration_years) VALUES (?,?,?,?,?)", savedId, checked, active, level, durationYears);
            else if (jdbc.update("UPDATE sager_course SET name=?,active=?,level=?,duration_years=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?", checked, active, level, durationYears, id, version) != 1)
                throw error(HttpStatus.CONFLICT, "stale_version", "O curso foi alterado. Recarregue a lista.");
        } catch (DataIntegrityViolationException error) {
            throw error(HttpStatus.CONFLICT, "duplicate_course", "Já existe um curso com esse nome.");
        }
        Set<String> changed = new HashSet<>();
        if (creating || !current.name().equals(checked)) changed.add("name");
        if (creating || current.active() != active) changed.add("active");
        if (creating || !Objects.equals(current.level(), level)) changed.add("level");
        if (creating || !Objects.equals(current.durationYears(), durationYears)) changed.add("durationYears");
        long resultingVersion = creating ? 0 : version + 1;
        audit.record(AuditResource.COURSE, savedId, creating ? AuditAction.CREATE : AuditAction.UPDATE, resultingVersion, changed);
        return new Course(savedId, checked, active, resultingVersion, level, durationYears);
    }
    private ResidentApiException error(HttpStatus status, String code, String message) { return new ResidentApiException(status, code, message); }
}
