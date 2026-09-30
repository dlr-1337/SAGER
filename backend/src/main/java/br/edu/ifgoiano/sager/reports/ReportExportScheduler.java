package br.edu.ifgoiano.sager.reports;
import org.slf4j.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component @Profile("local")
@ConditionalOnProperty(prefix="sager.reports.worker",name="enabled",havingValue="true",matchIfMissing=true)
public class ReportExportScheduler {
 private static final Logger LOG=LoggerFactory.getLogger(ReportExportScheduler.class);private final ReportExportWorker worker;
 public ReportExportScheduler(ReportExportWorker worker){this.worker=worker;}
 @Scheduled(initialDelay=5000,fixedDelay=5000)
 public void tick(){try{worker.expire();for(int i=0;i<4&&worker.runOnce();i++){/* bounded batch */}}catch(RuntimeException e){LOG.error("report_export_failure exceptionType={}",e.getClass().getSimpleName());}}
}
