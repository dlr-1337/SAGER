package br.edu.ifgoiano.sager.reports;
import br.edu.ifgoiano.sager.auth.*;
import br.edu.ifgoiano.sager.discipline.DisciplineActor;
import java.util.Set;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
@Component @Profile("local")
public class ReportingActor {
 private final DisciplineActor actor;
 public ReportingActor(DisciplineActor actor){this.actor=actor;}
 public LocalAccount current(){return actor.current();}
 public LocalAccount administrative(){var a=current();if(!Set.of("gestor","supervisor").contains(a.profile()))throw new ReportingApiException(HttpStatus.FORBIDDEN,"forbidden","Consulta administrativa necessária.");return a;}
 public LocalAccount supervisor(){return actor.supervisor();}
 public LocalAccount resident(){return actor.resident();}
}
