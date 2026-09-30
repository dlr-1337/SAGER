package br.edu.ifgoiano.sager.reports;
import java.io.ByteArrayOutputStream;
import java.time.Clock;
import java.util.*;
import br.edu.ifgoiano.sager.documents.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service @Profile({ "local", "production" })
public class ReportExportWorker {
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
  var s=work.snapshot();List<String> lines=new ArrayList<>();
  lines.add(String.join(" | ",s.columns().stream().map(ReportModels.Column::label).toList()));
  for(var row:work.rows())lines.add(String.join(" | ",s.columns().stream().map(c->value(row.get(c.key()))).toList()));
  return pdf.render(new PdfTextRenderer.Document("Relatório SAGER",s.catalogCode()+" | Consulta "+s.id(),List.of(
   new PdfTextRenderer.Section("Consulta congelada",List.of("Período: "+s.filters().from()+" a "+s.filters().to(),"Referência: "+s.asOf(),"Linhas: "+s.rowCount(),"Hash da consulta: "+s.contentHash())),
   new PdfTextRenderer.Section("Resultados",lines))));
 }
 private byte[] xlsx(ReportExportJobs.Work work){
  try(var workbook=new XSSFWorkbook();var output=new ByteArrayOutputStream()){
   var data=workbook.createSheet("Resultados");var columns=work.snapshot().columns();var header=data.createRow(0);
   CellStyle heading=workbook.createCellStyle();Font font=workbook.createFont();font.setBold(true);heading.setFont(font);
   for(int c=0;c<columns.size();c++){var cell=header.createCell(c,CellType.STRING);cell.setCellValue(columns.get(c).label());cell.setCellStyle(heading);data.setColumnWidth(c,28*256);}
   int index=1;for(var values:work.rows()){var row=data.createRow(index++);for(int c=0;c<columns.size();c++){
    Object v=values.get(columns.get(c).key());if(v instanceof Number n)row.createCell(c,CellType.NUMERIC).setCellValue(n.doubleValue());
    else row.createCell(c,CellType.STRING).setCellValue(value(v));
   }}
   data.createFreezePane(0,1);var meta=workbook.createSheet("Consulta");
   var s=work.snapshot();List<String[]> metadata=List.of(new String[]{"Consulta",s.id().toString()},new String[]{"Catálogo",s.catalogCode()},new String[]{"Referência",s.asOf().toString()},new String[]{"Período",s.filters().from()+" a "+s.filters().to()},new String[]{"Linhas",Integer.toString(s.rowCount())},new String[]{"Hash",s.contentHash()});
   for(int i=0;i<metadata.size();i++){var row=meta.createRow(i);row.createCell(0,CellType.STRING).setCellValue(metadata.get(i)[0]);row.createCell(1,CellType.STRING).setCellValue(metadata.get(i)[1]);}
   workbook.write(output);return output.toByteArray();
  }catch(java.io.IOException e){throw new PrivateFileException("Não foi possível gerar XLSX.");}
 }
 private String value(Object value){return value==null?"":value.toString();}
}
