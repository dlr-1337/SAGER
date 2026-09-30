export type CallMark = 'PRESENTE' | 'AUSENTE' | 'AUSENCIA_JUSTIFICADA';
export interface CallContext {
  accommodationId: string | null;
  referenceDate: string;
  now: string;
  zone: string;
  windowStart: string;
  windowEnd: string;
  outsideWindow: boolean;
  existingCallId: string | null;
  eligibleResidents: number;
  accommodations: { id: string; code: string; name: string }[];
  missingBirthDates: {
    residentId: string;
    residentName: string;
    enrollment: string;
    roomNumber: string;
  }[];
}
export interface CallHistory {
  id: string;
  mark: CallMark;
  authorizedExitId: string | null;
  authorizedExitType: string | null;
  justification: string | null;
  recordedAt: string;
  actorId: string;
  actorProfile: string;
  version: number;
  callVersion: number;
}
export interface CallResident {
  id: string;
  residentId: string;
  residentName: string;
  enrollment: string;
  birthDate: string;
  roomId: string;
  roomNumber: string;
  mark: CallMark | null;
  authorizedExitId: string | null;
  authorizedExitType: string | null;
  version: number;
  history: CallHistory[];
  authorizedExits: { id: string; type: 'SHORT' | 'LONG' }[];
}
export interface NightCall {
  id: string;
  accommodationId: string;
  accommodationName: string;
  referenceDate: string;
  status: 'ABERTA' | 'FECHADA';
  version: number;
  openedAt: string;
  closedAt: string | null;
  outsideWindowConfirmed: boolean;
  justification: string | null;
  closeOutsideWindowConfirmed: boolean;
  closeJustification: string | null;
  summary: { total: number; present: number; absent: number; justified: number; unmarked: number };
  records: CallResident[];
}
export interface ExitEligibility {
  residentId: string;
  residentName: string;
  enrollment: string;
  birthDate: string | null;
  roomId: string | null;
  roomNumber: string | null;
  accommodationId: string | null;
  eligible: boolean;
  blockers: string[];
  currentDate: string;
  now: string;
  zone: string;
}
export type ShortExitStatus =
  | 'AGUARDANDO_ANALISE'
  | 'APROVADA'
  | 'EM_ANDAMENTO'
  | 'RETORNO_CONFIRMADO'
  | 'RETORNO_CONFIRMADO_COM_ATRASO'
  | 'REJEITADA'
  | 'CANCELADA'
  | 'EXPIRADA';
export interface ShortExitInput {
  departureMode: 'NOW' | 'SCHEDULED';
  requestedDepartureAt?: string;
  expectedReturnAt: string;
  reason: string;
  notes: string | null;
}
export interface ExitHistory {
  id: string;
  event: string;
  version: number;
  recordedAt: string;
  effectiveAt: string | null;
  actorId: string;
  actorProfile: string;
  origin: string;
  justification: string | null;
  departureMode: string;
  requestedDepartureAt: string;
  expectedReturnAt: string;
  reason: string;
  notes: string | null;
  status: ShortExitStatus;
  decision: string | null;
  decisionComment: string | null;
  actualDepartureAt: string | null;
  actualReturnAt: string | null;
  lateObservation: string | null;
  cancellationReason: string | null;
  expiryReason: string | null;
}
export interface ShortExit {
  id: string;
  residentId: string;
  residentName: string;
  enrollment: string;
  departureMode: 'NOW' | 'SCHEDULED';
  requestedDepartureAt: string;
  expectedReturnAt: string;
  reason: string;
  notes: string | null;
  status: ShortExitStatus;
  decision: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  actualDepartureAt: string | null;
  actualReturnAt: string | null;
  lateObservation: string | null;
  cancellationReason: string | null;
  expiryReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  departureRecordedAt: string | null;
  returnRecordedAt: string | null;
  deadlineAt: string | null;
  deadlinePassed: boolean;
  now: string;
  zone: string;
  capabilities: {
    canEdit: boolean;
    canDecide: boolean;
    canCancel: boolean;
    canDepart: boolean;
    canReturn: boolean;
  };
  history: ExitHistory[];
}
export interface PhysicalExitInput {
  version: number;
  timeMode: 'NOW' | 'RETROACTIVE';
  occurredAt?: string;
  justification?: string;
  lateObservation?: string;
}
