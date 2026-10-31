export type CleaningCriterion = 'PISO' | 'SUPERFICIES' | 'RESIDUOS' | 'ORGANIZACAO';
export type CleaningCriteria = Record<CleaningCriterion, number>;
export type RankingPeriod = 'WEEK' | 'MONTH' | 'SEMESTER';
export interface CleaningPolicy {
  version: number;
  weights: CleaningCriteria;
  lowScoreThreshold: number;
  zone: 'America/Sao_Paulo';
  now: string;
  currentDate: string;
}
export interface CleaningParticipant {
  allocationId: string;
  residentId: string;
  residentName: string;
}
export interface CleaningRevision {
  version: number;
  criteria: CleaningCriteria;
  score: number;
  observation: string | null;
  reason: string | null;
  recordedAt: string;
  recordedBy: string;
}
export interface CleaningFeedback {
  previousScore: number | null;
  newScore: number;
  delta: number | null;
  periodMean: number | null;
  position: number | null;
  rankingReference: RankingPeriod;
  from: string;
  to: string;
}
export interface OwnCleaningAssessment {
  id: string;
  roomId: string;
  roomCode: string;
  evaluatedAt: string;
  assessmentDate: string;
  criteria: CleaningCriteria;
  score: number;
  observation: string | null;
  version: number;
  feedback: CleaningFeedback;
}
export interface CleaningAssessment extends OwnCleaningAssessment {
  accommodationId: string;
  timeMode: 'NOW' | 'RETROACTIVE';
  policyVersion: number;
  recordedAt: string;
  recordedBy: string;
  participants: CleaningParticipant[];
  revisions: CleaningRevision[];
}
export interface CleaningRankRow {
  roomId: string | null;
  roomCode: string;
  mean: number | null;
  position: number | null;
  assessmentCount: number | null;
  own: boolean;
}
export interface CleaningRanking {
  period: RankingPeriod;
  referenceDate: string;
  from: string;
  to: string;
  items: CleaningRankRow[];
}
export interface MonthlyIndicator {
  month: string;
  unjustifiedAbsences: number;
  confirmedLateReturns: number;
  activeWarnings: number;
}
export interface CleaningInput {
  roomId: string;
  timeMode: 'NOW' | 'RETROACTIVE';
  evaluatedAt?: string;
  registrationReason?: string;
  criteria: CleaningCriteria;
  observation: string | null;
}
export interface CleaningCorrection {
  version: number;
  criteria: CleaningCriteria;
  observation: string | null;
  reason: string;
}
export interface CleaningFilters {
  accommodationId?: string;
  unitId?: string;
  roomId?: string;
  residentId?: string;
  from?: string;
  to?: string;
}
export interface CleaningPage<T> {
  items: T[];
  nextCursor: number | null;
}
