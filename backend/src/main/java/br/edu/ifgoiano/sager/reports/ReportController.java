package br.edu.ifgoiano.sager.reports;
import static br.edu.ifgoiano.sager.reports.ReportModels.*;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
@RestController @Profile({ "local", "production" }) @RequestMapping("/api/v1/relatorios")
public class ReportController {
 private final ReportService service;public ReportController(ReportService service){this.service=service;}
 @GetMapping("/catalogo") public ResponseEntity<Catalog> catalog(){return ok(service.catalog());}
 @PostMapping("/consultas") public ResponseEntity<Snapshot> create(@RequestBody JsonNode body){return ok(service.create(body));}
 @GetMapping("/consultas/{id}") public ResponseEntity<Snapshot> snapshot(@PathVariable UUID id){return ok(service.get(id));}
 @GetMapping("/consultas/{id}/linhas") public ResponseEntity<Rows> rows(@PathVariable UUID id,@RequestParam(defaultValue="0")int offset,@RequestParam(defaultValue="20")int limit){return ok(service.rows(id,offset,limit));}
 @PostMapping("/consultas/{id}/exportacoes") public ResponseEntity<Export> request(@PathVariable UUID id,@RequestBody JsonNode body){return ok(service.requestExport(id,body));}
 @GetMapping("/exportacoes/{id}") public ResponseEntity<Export> job(@PathVariable UUID id){return ok(service.getExport(id));}
 @GetMapping("/exportacoes/{id}/arquivo") public ResponseEntity<byte[]> download(@PathVariable UUID id){var f=service.download(id);String ext=f.format().toLowerCase(java.util.Locale.ROOT);return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(f.format().equals("PDF")?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).header("Content-Disposition","attachment; filename=\"sager-relatorio-"+id+"."+ext+"\"").body(f.bytes());}
 private <T>ResponseEntity<T>ok(T value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
}
