package br.edu.ifgoiano.sager.cleaning;
import static br.edu.ifgoiano.sager.cleaning.CleaningModels.*;
import java.time.LocalDate;
import java.util.*;
import br.edu.ifgoiano.sager.discipline.DisciplineModels.Page;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
@RestController @Profile("local") @RequestMapping("/api/v1")
public class CleaningController {
 private final CleaningService service;public CleaningController(CleaningService service){this.service=service;}
 @GetMapping("/limpeza/politica") public ResponseEntity<Policy> policy(){return ok(service.policy());}
 @GetMapping("/limpeza/avaliacoes") public ResponseEntity<Page<Assessment>> list(@RequestParam(required=false)UUID roomId,@RequestParam(required=false)UUID residentId,@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to,@RequestParam(defaultValue="20")int limit,@RequestParam(required=false)Long beforeSequence){return ok(service.list(roomId,residentId,from,to,limit,beforeSequence));}
 @GetMapping("/limpeza/avaliacoes/{id}") public ResponseEntity<Assessment> detail(@PathVariable UUID id){return ok(service.get(id));}
 @PostMapping("/limpeza/avaliacoes") public ResponseEntity<Assessment> create(@RequestBody JsonNode body){return ok(service.create(body));}
 @PostMapping("/limpeza/avaliacoes/{id}/corrigir") public ResponseEntity<Assessment> correct(@PathVariable UUID id,@RequestBody JsonNode body){return ok(service.correct(id,body));}
 @GetMapping("/limpeza/ranking") public ResponseEntity<Ranking> ranking(@RequestParam(defaultValue="MONTH")String period,@RequestParam(required=false)LocalDate referenceDate){return ok(service.ranking(period,referenceDate));}
 @GetMapping("/limpeza/indicadores") public ResponseEntity<List<Indicator>> indicators(@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to,@RequestParam(required=false)UUID residentId){return ok(service.indicators(from,to,residentId));}
 @GetMapping("/me/limpeza/avaliacoes") public ResponseEntity<Page<OwnAssessment>> ownList(@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to,@RequestParam(defaultValue="20")int limit,@RequestParam(required=false)Long beforeSequence){return ok(service.ownList(from,to,limit,beforeSequence));}
 @GetMapping("/me/limpeza/avaliacoes/{id}") public ResponseEntity<OwnAssessment> own(@PathVariable UUID id){return ok(service.own(id));}
 private <T>ResponseEntity<T>ok(T value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
}
