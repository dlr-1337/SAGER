export type DisciplineCategory = 'AUSENCIA' | 'ATRASO_RETORNO' | 'LIMPEZA' | 'OUTRA';
export type WarningSeverity = 'LEVE' | 'MODERADA' | 'GRAVE';
export type NotificationStatus =
  'PENDENTE' | 'VISUALIZADA' | 'EM_ANALISE' | 'ARQUIVADA' | 'CONVERTIDA';
export type ArchiveReason = 'ORIGEM_RETIFICADA' | 'SEM_EVIDENCIA' | 'NAO_PROCEDE' | 'OUTRO';
export type CommunicationKind = 'AVISO' | 'ADVERTENCIA' | 'TERMO';
export type CommunicationStatus = 'PUBLICADO' | 'SUPERADO' | 'RETIRADO' | 'ANULADO';
export type EvidenceValue =
  string | number | boolean | null | EvidenceValue[] | { [key: string]: EvidenceValue };
export interface CursorPage<T> {
  items: T[];
  nextCursor: number | null;
}
export interface DisciplineContext {
  now: string;
  currentDate: string;
  zone: 'America/Sao_Paulo';
  categories: DisciplineCategory[];
  severities: WarningSeverity[];
}
export interface SourceRevision {
  version: number;
  sourceVersion: number;
  valid: boolean;
  evidence: EvidenceValue;
  occurredAt: string;
  recordedAt: string;
}
export interface DisciplineOccurrence {
  id: string;
  residentId: string;
  residentName: string;
  sourceType: string;
  sourceId: string;
  category: DisciplineCategory;
  valid: boolean;
  sourceVersion: number;
  version: number;
  occurredAt: string;
  evidence: EvidenceValue;
  revisions: SourceRevision[];
}
export interface NotificationEvent {
  id: string;
  action: string;
  actorId: string;
  recordedAt: string;
  resultingVersion: number;
  occurrenceVersion: number;
  reasonCode: ArchiveReason | null;
  reason: string | null;
}
export interface DisciplineNotification {
  id: string;
  occurrenceId: string;
  residentId: string;
  residentName: string;
  category: DisciplineCategory;
  status: NotificationStatus;
  requiresReview: boolean;
  version: number;
  occurrenceVersion: number;
  policyCode: string;
  policyVersion: number;
  createdAt: string;
  valid: boolean;
  evidence: EvidenceValue;
  events: NotificationEvent[];
}
export interface WarningInput {
  category: DisciplineCategory;
  severity: WarningSeverity;
  description: string;
  justification: string;
  warningDate: string;
}
export interface DisciplineWarning extends WarningInput {
  id: string;
  residentId: string;
  residentName: string;
  occurrenceId: string | null;
  notificationId: string | null;
  status: 'VIGENTE' | 'ANULADA';
  requiresReview: boolean;
  issuedAt: string;
  issuedBy: string;
  communicationId: string;
  version: number;
  annulmentReason: string | null;
}
export interface RecurrenceCandidate {
  category: DisciplineCategory;
  minimumWarnings: number;
  windowDays: number;
  warnings: DisciplineWarning[];
  candidate: boolean;
}
export interface PrivateDocument {
  id: string;
  sha256: string;
  size: number;
  state: string;
}
export interface DisciplineTerm {
  id: string;
  residentId: string;
  residentName: string;
  warningIds: string[];
  decision: string;
  status: 'EMITIDO' | 'ANULADO';
  issuedAt: string;
  issuedBy: string;
  communicationId: string;
  document: PrivateDocument;
  version: number;
  annulmentReason: string | null;
}
/** A opção de "Quem recebe?"; o servidor monta dela o grupo gravado (notice-recipient-summary). */
export type NoticeAudienceInput =
  | { kind: 'TODOS' | 'MAIORES' | 'MENORES' | 'ESCOLHER' }
  | { kind: 'ALOJAMENTO'; accommodationId: string }
  | { kind: 'QUARTO'; roomId: string };
export interface NoticeInput {
  title: string;
  body: string;
  residentIds: string[];
  audience?: NoticeAudienceInput;
}
export interface PublishedNotice extends Omit<NoticeInput, 'audience'> {
  id: string;
  /** Grupo de "Quem recebe?" gravado no rascunho; nulo ou ausente em aviso antigo. */
  audienceLabel?: string | null;
  status: 'RASCUNHO' | 'PUBLICADO' | 'RETIRADO';
  version: number;
  publishedAt: string | null;
  communicationId: string | null;
  withdrawalReason: string | null;
}
export interface OwnCommunication {
  id: string;
  kind: CommunicationKind;
  sourceId: string;
  contentVersion: number;
  title: string;
  body: string;
  publishedAt: string;
  status: CommunicationStatus;
  stateReason: string | null;
  requiresReview: boolean;
  readAt: string | null;
  acknowledgedAt: string | null;
  document: PrivateDocument | null;
}
