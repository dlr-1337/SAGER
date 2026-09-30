package br.edu.ifgoiano.sager.reports;
import java.time.*;
import java.util.*;
import br.edu.ifgoiano.sager.documents.StoredFile;
public final class ReportModels {
 private ReportModels(){}
 public record Column(String key,String label,String type){}
 public record CatalogItem(String code,String title,List<String> statuses,List<Column> columns){}
 public record Catalog(long version,List<CatalogItem> items,int maxPeriodDays,int maxRows,int defaultPageSize,int maxPageSize,long expiresAfterHours){}
 public record Filters(LocalDate from,LocalDate to,UUID accommodationId,UUID roomId,UUID residentId,String status){}
 public record Snapshot(UUID id,String catalogCode,long catalogVersion,Filters filters,List<Column> columns,int rowCount,Map<String,Object> summary,List<Map<String,Object>> monthly,String contentHash,OffsetDateTime asOf,OffsetDateTime expiresAt){}
 public record Rows(UUID snapshotId,int offset,int limit,Integer nextOffset,int total,List<Map<String,Object>> items){}
 public record Export(UUID id,UUID snapshotId,String format,String status,OffsetDateTime createdAt,OffsetDateTime expiresAt,int attempts,String errorCode,StoredFile document){}
}
