package br.edu.ifgoiano.sager.cleaning;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
public final class CleaningModels {
 private CleaningModels(){}
 public record Policy(long version,Map<String,BigDecimal> weights,BigDecimal lowScoreThreshold,String zone,OffsetDateTime now,LocalDate currentDate){}
 public record Participant(UUID allocationId,UUID residentId,String residentName){}
 public record Revision(long version,Map<String,BigDecimal> criteria,BigDecimal score,String observation,String reason,OffsetDateTime recordedAt,UUID recordedBy){}
 public record Feedback(BigDecimal previousScore,BigDecimal newScore,BigDecimal delta,BigDecimal periodMean,Integer position,String rankingReference,LocalDate from,LocalDate to){}
 public record Assessment(UUID id,UUID roomId,String roomCode,UUID accommodationId,OffsetDateTime evaluatedAt,LocalDate assessmentDate,String timeMode,long policyVersion,Map<String,BigDecimal> criteria,BigDecimal score,String observation,long version,OffsetDateTime recordedAt,UUID recordedBy,List<Participant> participants,List<Revision> revisions,Feedback feedback){}
 public record OwnAssessment(UUID id,UUID roomId,String roomCode,OffsetDateTime evaluatedAt,LocalDate assessmentDate,Map<String,BigDecimal> criteria,BigDecimal score,String observation,long version,Feedback feedback){}
 public record RankRow(UUID roomId,String roomCode,BigDecimal mean,Integer position,Integer assessmentCount,boolean own){}
 public record Ranking(String period,LocalDate referenceDate,LocalDate from,LocalDate to,List<RankRow> items){}
 public record Indicator(String month,long unjustifiedAbsences,long confirmedLateReturns,long activeWarnings){}
}
