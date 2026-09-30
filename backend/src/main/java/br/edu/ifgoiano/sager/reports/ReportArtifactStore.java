package br.edu.ifgoiano.sager.reports;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import br.edu.ifgoiano.sager.documents.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Transient UUID-addressed reports. It can never be configured over the permanent document root. */
@Component @Profile({ "local", "production" })
public class ReportArtifactStore {
 private final PrivateFileStore store;private final Path root;private final Object rootKey;private final FileTime rootCreated;private final Clock clock;
 public ReportArtifactStore(@Value("$"+"{sager.reports.private-root:}")String directory,
   @Value("$"+"{sager.documents.private-root:}")String permanent,Clock clock){
  Path report=directory.isBlank()?Path.of(System.getProperty("user.home"),".sager","private-reports"):Path.of(directory);
  Path documents=permanent.isBlank()?Path.of(System.getProperty("user.home"),".sager","private-documents"):Path.of(permanent);
  report=report.toAbsolutePath().normalize();documents=documents.toAbsolutePath().normalize();
  if(report.startsWith(documents)||documents.startsWith(report))throw new PrivateFileException("Relatórios exigem raiz privada separada dos documentos permanentes.");
  this.store=new PrivateFileStore(report,52428800);this.root=report;this.clock=clock;
  try{var attrs=Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);this.rootKey=attrs.fileKey();this.rootCreated=attrs.creationTime();}
  catch(IOException e){throw new PrivateFileException("Armazenamento de relatórios indisponível.");}
 }
 public StoredFile store(UUID id,byte[] bytes){
  var file=store.storeImmutable(id,new ByteArrayInputStream(bytes));
  try{validate();Files.setLastModifiedTime(root.resolve(id.toString()),FileTime.from(clock.instant()));}
  catch(IOException e){throw new PrivateFileException("Armazenamento transitório indisponível.");}
  return file;
 }
 public byte[] open(StoredFile file){return store.openVerified(file);}
 public void delete(UUID id){
  if(id==null)return;
  try{validate();Path target=root.resolve(id.toString());if(Files.exists(target,LinkOption.NOFOLLOW_LINKS)&&Files.isDirectory(target,LinkOption.NOFOLLOW_LINKS))throw new PrivateFileException("Arquivo transitório inválido.");Files.deleteIfExists(target);}
  catch(IOException e){throw new PrivateFileException("Não foi possível expirar o arquivo transitório.");}
 }
 public void purgeOrphans(Instant cutoff,Set<UUID> references){
  try{validate();try(var paths=Files.list(root)){for(Path path:paths.toList()){
   String name=path.getFileName().toString();String uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
   // PrivateFileStore creates only these sidecars. A killed process cannot run its finally cleanup.
   if(!name.matches(uuid+"(?:\\.lock|-[0-9]+\\.part)?"))continue;
   UUID id=UUID.fromString(name.substring(0,36));var attrs=Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
   if(!references.contains(id)&&attrs.isRegularFile()&&!attrs.isSymbolicLink()&&attrs.lastModifiedTime().toInstant().isBefore(cutoff)){
    validate();Files.deleteIfExists(path);
   }
  }}}
  catch(IOException e){throw new PrivateFileException("Limpeza de relatórios indisponível.");}
 }
 private void validate()throws IOException{
  var attrs=Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
  if(attrs.isSymbolicLink()||!attrs.isDirectory()||!root.toRealPath().equals(root)||!Objects.equals(attrs.fileKey(),rootKey)||rootKey==null&&!attrs.creationTime().equals(rootCreated))throw new PrivateFileException("Raiz transitória inválida.");
 }
}
