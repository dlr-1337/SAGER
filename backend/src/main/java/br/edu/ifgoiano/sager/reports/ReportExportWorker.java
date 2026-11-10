package br.edu.ifgoiano.sager.reports;
import java.io.ByteArrayOutputStream;
import java.math.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import br.edu.ifgoiano.sager.documents.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service @Profile({ "local", "production" })
public class ReportExportWorker {
 private static final DateTimeFormatter DAY=DateTimeFormatter.ofPattern("dd/MM/yyyy");
 private static final DateTimeFormatter MOMENT=DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm").withZone(ZoneId.of("America/Sao_Paulo"));
 private static final Map<String,String> TYPES=Map.of("PRESENCA","Presença na chamada","SAIDAS","Saídas e retornos","LIMPEZA","Limpeza dos quartos","OCORRENCIAS","Ocorrências","NOTIFICACOES","Notificações","ADVERTENCIAS","Advertências","TERMOS","Termos de compromisso");
 private static final Map<String,String> STATUSES=Map.ofEntries(Map.entry("PRESENTE","Presente"),Map.entry("AUSENTE","Ausente sem justificativa"),Map.entry("AUSENCIA_JUSTIFICADA","Ausência justificada"),Map.entry("PENDENTE","Pendente"),Map.entry("CHAMADA_ABERTA","Chamada ainda aberta"),Map.entry("AGUARDANDO_ANALISE","Aguardando análise"),Map.entry("APROVADA","Aprovada"),Map.entry("REJEITADA","Rejeitada"),Map.entry("CANCELADA","Cancelada"),Map.entry("EXPIRADA","Expirada"),Map.entry("EM_ANDAMENTO","Em andamento"),Map.entry("RETORNO_CONFIRMADO","Retorno confirmado"),Map.entry("RETORNO_CONFIRMADO_COM_ATRASO","Retorno confirmado com atraso"),Map.entry("ABAIXO_LIMITE","Abaixo do limiar"),Map.entry("DENTRO_LIMITE","Dentro do limiar"),Map.entry("VALIDA","Origem válida"),Map.entry("INVALIDADA","Origem invalidada"),Map.entry("VISUALIZADA","Visualizada"),Map.entry("EM_ANALISE","Em análise"),Map.entry("ARQUIVADA","Arquivada"),Map.entry("CONVERTIDA","Convertida"),Map.entry("VIGENTE","Vigente"),Map.entry("ANULADA","Anulada"),Map.entry("EMITIDO","Termo emitido"),Map.entry("ANULADO","Termo anulado"));
 private static final Map<String,String> ORIGINS=Map.of("AUSENCIA","Ausência","ATRASO_RETORNO","Atraso no retorno","LIMPEZA","Limpeza","OUTRA","Outra categoria","NIGHT_CALL","Chamada noturna","SHORT_RETURN","Saída curta","LONG_RETURN","Saída longa","CLEANING_ASSESSMENT","Avaliação de limpeza","MANUAL","Decisão manual","RECURRENCE","Reincidência");
 private final ReportExportJobs jobs;private final ReportArtifactStore files;private final PdfTextRenderer pdf;private final Clock clock;
 public ReportExportWorker(ReportExportJobs jobs,ReportArtifactStore files,PdfTextRenderer pdf,Clock clock){this.jobs=jobs;this.files=files;this.pdf=pdf;this.clock=clock;}
 /** Can run while nobody is browsing. Persisted leases make a restarted worker converge. */
 public boolean runOnce(){
  var work=jobs.claim();if(work==null)return false;StoredFile file=null;
  try{
   byte[] bytes=work.format().equals("PDF")?pdf(work):xlsx(work);file=files.store(UUID.randomUUID(),bytes);
   if(!jobs.finish(work,file))files.delete(file.id());
  }catch(RuntimeException e){
   if(file!=null)files.delete(file.id());jobs.fail(work,"export_failed");
  }
  return true;
 }
 public void expire(){for(UUID id:jobs.expire()){files.delete(id);jobs.forgetExpiredFile(id);}files.purgeOrphans(clock.instant().minus(java.time.Duration.ofHours(24)),jobs.references());}
 private byte[] pdf(ReportExportJobs.Work work){
  var s=work.snapshot();var columns=visible(s);List<String> lines=new ArrayList<>();
  for(var row:work.rows()){
   // Two fixed lines per record: what happened, then who and where.
   StringJoiner what=new StringJoiner(" · "),who=new StringJoiner(" · ");
   for(var c:columns){String text=display(c,row.get(c.key()));if(!text.isEmpty())(List.of("date","type","status").contains(c.key())?what:who).add(c.label()+": "+text);}
   lines.add(what+"\n"+who);
  }
  if(lines.isEmpty())lines.add("Nenhum registro neste período.");
  return pdf.render(new PdfTextRenderer.Document(title(s),"Período: "+period(s),List.of(
   new PdfTextRenderer.Section("Resumo",List.of(filters(work),"Gerado em: "+MOMENT.format(s.asOf()),"Total de registros: "+s.rowCount())),
   new PdfTextRenderer.Section("Registros",lines),
   new PdfTextRenderer.Section("Conferência",List.of("Código de conferência do relatório: "+s.contentHash())))));
 }
 private byte[] xlsx(ReportExportJobs.Work work){
  try(var workbook=new XSSFWorkbook();var output=new ByteArrayOutputStream()){
   var s=work.snapshot();var data=workbook.createSheet("Resultados");var columns=visible(s);
   CellStyle heading=workbook.createCellStyle();Font font=workbook.createFont();font.setBold(true);heading.setFont(font);
   CellStyle day=workbook.createCellStyle();day.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy"));
   CellStyle decimal=workbook.createCellStyle();decimal.setDataFormat(workbook.createDataFormat().getFormat("0.00"));
   var title=data.createRow(0).createCell(0,CellType.STRING);title.setCellValue(title(s));title.setCellStyle(heading);
   data.createRow(1).createCell(0,CellType.STRING).setCellValue("Período: "+period(s));
   data.createRow(2).createCell(0,CellType.STRING).setCellValue(filters(work));
   var header=data.createRow(3);
   for(int c=0;c<columns.size();c++){var cell=header.createCell(c,CellType.STRING);cell.setCellValue(columns.get(c).label());cell.setCellStyle(heading);data.setColumnWidth(c,28*256);}
   int index=4;for(var values:work.rows()){var row=data.createRow(index++);for(int c=0;c<columns.size();c++){
    var column=columns.get(c);Object v=values.get(column.key());
    if(v instanceof Number n){var cell=row.createCell(c,CellType.NUMERIC);cell.setCellValue(n.doubleValue());cell.setCellStyle(decimal);}
    else if(v!=null&&column.type().equals("DATE")){var cell=row.createCell(c);cell.setCellValue(LocalDate.parse(v.toString()));cell.setCellStyle(day);}
    else row.createCell(c,CellType.STRING).setCellValue(display(column,v));
   }}
   data.createFreezePane(0,4);var meta=workbook.createSheet("Consulta");meta.setColumnWidth(0,24*256);meta.setColumnWidth(1,70*256);
   List<String[]> metadata=List.of(new String[]{"Relatório",title(s)},new String[]{"Período",period(s)},new String[]{"Gerado em",MOMENT.format(s.asOf())},new String[]{"Registros",Integer.toString(s.rowCount())},new String[]{"Filtros",filters(work).substring("Filtros: ".length())},new String[]{"Código de conferência",s.contentHash()});
   for(int i=0;i<metadata.size();i++){var row=meta.createRow(i);row.createCell(0,CellType.STRING).setCellValue(metadata.get(i)[0]);row.createCell(1,CellType.STRING).setCellValue(metadata.get(i)[1]);}
   workbook.write(output);return output.toByteArray();
  }catch(java.io.IOException e){throw new PrivateFileException("Não foi possível gerar XLSX.");}
 }
 // Stored snapshots keep their UUID columns because the hash covers them; only the file hides them.
 private static List<ReportModels.Column> visible(ReportModels.Snapshot s){return s.columns().stream().filter(c->!c.type().equals("UUID")).toList();}
 private static String title(ReportModels.Snapshot s){return s.catalogCode().equals("CONSOLIDADO")?"Relatório geral":"Relatório de "+TYPES.getOrDefault(s.catalogCode(),s.catalogCode()).toLowerCase(Locale.of("pt","BR"));}
 private static String period(ReportModels.Snapshot s){return s.filters().from().format(DAY)+" a "+s.filters().to().format(DAY);}
 private String filters(ReportExportJobs.Work work){
  var f=work.snapshot().filters();var names=jobs.filterNames(f);var first=work.rows().isEmpty()?Map.<String,Object>of():work.rows().getFirst();
  StringJoiner line=new StringJoiner(" · ");
  if(f.accommodationId()!=null)line.add("Alojamento: "+named(names.get("accommodation")));
  if(f.unitId()!=null)line.add("Unidade: "+named(names.get("unit")));
  // With these filters every frozen row has the same value, which is the one the file shows.
  if(f.roomId()!=null)line.add("Quarto: "+named(first.getOrDefault("roomCode",names.get("room"))));
  if(f.residentId()!=null)line.add("Residente: "+named(first.getOrDefault("residentName",names.get("resident"))));
  if(f.status()!=null)line.add("Situação: "+STATUSES.getOrDefault(f.status(),f.status()));
  return "Filtros: "+(line.length()==0?"nenhum":line);
 }
 private static String named(Object name){return name==null?"não encontrado":name.toString();}
 private static String display(ReportModels.Column column,Object value){
  if(value==null)return "";
  String text=value.toString();
  if(value instanceof Number)return new BigDecimal(text).setScale(2,RoundingMode.HALF_UP).toPlainString().replace('.',',');
  if(column.type().equals("DATE"))return LocalDate.parse(text).format(DAY);
  return switch(column.key()){
   case "type"->TYPES.getOrDefault(text,text);
   case "status"->STATUSES.getOrDefault(text,text);
   case "category","sourceType"->ORIGINS.getOrDefault(text,text);
   default->text;
  };
 }
}
