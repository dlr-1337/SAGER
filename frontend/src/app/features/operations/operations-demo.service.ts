import { computed, Injectable, signal } from '@angular/core';

export type ExitKind = 'Curta' | 'Longa';
export type ExitStatus =
  | 'Aguardando análise'
  | 'Aguardando assinatura'
  | 'Falha no envio'
  | 'Aprovada'
  | 'Em andamento'
  | 'Rejeitada'
  | 'Retorno confirmado'
  | 'Retorno confirmado com atraso';

export interface TimelineEvent {
  label: string;
  at: string;
  detail?: string;
}

export interface ExitRequest {
  id: string;
  residentId: string;
  resident: string;
  registration: string;
  room: string;
  kind: ExitKind;
  departure: string;
  expectedReturn: string;
  reason: string;
  notes: string;
  status: ExitStatus;
  guardian?: string;
  signed: boolean;
  messageState?: 'Aguardando envio' | 'Enviada' | 'Falha no envio';
  timeline: TimelineEvent[];
}

export interface MinorResident {
  id: string;
  name: string;
  room: string;
  block: string;
  registration: string;
  approvedAuthorization: boolean;
}

export type AttendanceMark = 'Presente' | 'Ausente' | 'Ausência justificada';
export interface AttendanceEntry {
  residentId: string;
  mark: AttendanceMark | null;
}

export type NotificationStatus = 'Pendente' | 'Visualizada' | 'Em análise' | 'Arquivada' | 'Convertida em advertência';
export interface InternalNotification {
  id: string;
  resident: string;
  source: string;
  at: string;
  reason: string;
  evidence: string;
  status: NotificationStatus;
  decision?: string;
  timeline: TimelineEvent[];
}

export interface ManualWarning {
  id: string;
  notificationId: string;
  resident: string;
  description: string;
  date: string;
  severity: string;
  justification: string;
}

export interface CleaningScenario {
  room: string;
  label: string;
  previous: number | null;
  next: number;
  position: number;
  date: string;
}

function offset(hours: number, minutes = 0): string {
  return new Date(Date.now() + hours * 3_600_000 + minutes * 60_000).toISOString();
}

function now(): string {
  return new Date().toISOString();
}

@Injectable({ providedIn: 'root' })
export class OperationsDemoService {
  readonly residentId = 'res-001';
  readonly minors: MinorResident[] = [
    { id: 'res-001', name: 'Ana Luísa Ribeiro', room: 'A-102', block: 'A', registration: '20241001', approvedAuthorization: false },
    { id: 'res-002', name: 'Pedro Henrique Silva', room: 'A-104', block: 'A', registration: '20241002', approvedAuthorization: true },
    { id: 'res-003', name: 'Beatriz Costa', room: 'B-201', block: 'B', registration: '20241003', approvedAuthorization: false },
    { id: 'res-004', name: 'Lucas Almeida', room: 'B-203', block: 'B', registration: '20241004', approvedAuthorization: false },
  ];

  readonly exits = signal<ExitRequest[]>([
    {
      id: 'S-1048', residentId: 'res-001', resident: 'Ana Luísa Ribeiro', registration: '20241001', room: 'A-102',
      kind: 'Longa', departure: offset(24), expectedReturn: offset(72), reason: 'Visita à família', notes: 'Retorno ao campus após o fim de semana.',
      status: 'Aguardando assinatura', guardian: 'Mariana Ribeiro', signed: false, messageState: 'Enviada',
      timeline: [{ label: 'Solicitação registrada', at: offset(-2) }, { label: 'Documento enviado ao responsável', at: offset(-1) }],
    },
    {
      id: 'S-1047', residentId: 'res-002', resident: 'Pedro Henrique Silva', registration: '20241002', room: 'A-104',
      kind: 'Curta', departure: offset(-1), expectedReturn: offset(2), reason: 'Compromisso pessoal', notes: '',
      status: 'Em andamento', signed: false,
      timeline: [{ label: 'Solicitação registrada', at: offset(-4) }, { label: 'Aprovada por supervisor', at: offset(-2) }, { label: 'Em andamento', at: offset(-1), detail: 'Cenário ilustrativo; evento operacional de partida ainda depende da AE.' }],
    },
    {
      id: 'S-1046', residentId: 'res-003', resident: 'Beatriz Costa', registration: '20241003', room: 'B-201',
      kind: 'Longa', departure: offset(30), expectedReturn: offset(78), reason: 'Consulta familiar', notes: '',
      status: 'Falha no envio', guardian: 'Carlos Costa', signed: false, messageState: 'Falha no envio',
      timeline: [{ label: 'Solicitação registrada', at: offset(-3) }, { label: 'Falha no envio simulado', at: offset(-2), detail: 'Serviço de demonstração indisponível.' }],
    },
    {
      id: 'S-1045', residentId: 'res-001', resident: 'Ana Luísa Ribeiro', registration: '20241001', room: 'A-102',
      kind: 'Curta', departure: offset(6), expectedReturn: offset(9), reason: 'Compra de materiais', notes: '',
      status: 'Aguardando análise', signed: false,
      timeline: [{ label: 'Solicitação registrada', at: offset(-1) }],
    },
  ]);

  readonly attendance = signal<AttendanceEntry[]>(this.minors.map((resident) => ({ residentId: resident.id, mark: null })));
  readonly callCompleted = signal(false);
  readonly callCompletedAt = signal<string | null>(null);
  readonly callLate = signal(false);
  readonly callSummary = computed(() => {
    const entries = this.attendance();
    return {
      marked: entries.filter((entry) => entry.mark !== null).length,
      total: entries.length,
      present: entries.filter((entry) => entry.mark === 'Presente').length,
      absent: entries.filter((entry) => entry.mark === 'Ausente').length,
      justified: entries.filter((entry) => entry.mark === 'Ausência justificada').length,
    };
  });

  readonly notifications = signal<InternalNotification[]>([
    {
      id: 'N-201', resident: 'Beatriz Costa', source: 'Chamada noturna', at: offset(-18),
      reason: 'Ausência registrada para análise', evidence: 'Registro demonstrativo de ausência sem autorização vinculada.', status: 'Pendente',
      timeline: [{ label: 'Notificação interna gerada', at: offset(-18) }],
    },
    {
      id: 'N-200', resident: 'Pedro Henrique Silva', source: 'Limpeza', at: offset(-36),
      reason: 'Avaliação sinalizada para revisão humana', evidence: 'Critério institucional de alerta ainda pendente de definição.', status: 'Em análise',
      timeline: [{ label: 'Notificação interna gerada', at: offset(-36) }, { label: 'Em análise', at: offset(-30) }],
    },
  ]);
  readonly warnings = signal<ManualWarning[]>([]);
  readonly cleaningScenarios: CleaningScenario[] = [
    { room: 'A-102', label: 'Reavaliação demonstrativa', previous: 7.5, next: 8.0, position: 2, date: now() },
    { room: 'A-104', label: 'Primeira avaliação demonstrativa', previous: null, next: 7.0, position: 3, date: now() },
    { room: 'B-201', label: 'Edição demonstrativa', previous: 6.0, next: 6.5, position: 4, date: now() },
  ];
  readonly cleaningFeedback = signal<CleaningScenario | null>(null);

  getExit(id: string): ExitRequest | undefined { return this.exits().find((item) => item.id === id); }
  getNotification(id: string): InternalNotification | undefined { return this.notifications().find((item) => item.id === id); }

  saveCleaningScenario(room: string): CleaningScenario | null {
    const scenario = this.cleaningScenarios.find((item) => item.room === room) ?? null;
    this.cleaningFeedback.set(scenario);
    return scenario;
  }

  setAttendanceMark(residentId: string, mark: AttendanceMark): void {
    if (this.callCompleted()) return;
    const resident = this.minors.find((item) => item.id === residentId);
    if (!resident || (mark === 'Ausência justificada' && !resident.approvedAuthorization)) return;
    this.attendance.update((items) => items.map((item) => item.residentId === residentId ? { ...item, mark } : item));
  }

  completeCall(late: boolean): boolean {
    if (this.callCompleted() || this.attendance().some((entry) => !entry.mark)) return false;
    this.callLate.set(late);
    this.callCompletedAt.set(now());
    this.callCompleted.set(true);
    return true;
  }

  createExit(input: Pick<ExitRequest, 'kind' | 'departure' | 'expectedReturn' | 'reason' | 'notes'>): ExitRequest {
    this.validateExit(input);
    const resident = this.minors.find((item) => item.id === this.residentId)!;
    const created: ExitRequest = {
      ...input, id: `S-${1050 + this.exits().length}`, residentId: resident.id, resident: resident.name,
      registration: resident.registration, room: resident.room,
      status: input.kind === 'Longa' ? 'Aguardando assinatura' : 'Aguardando análise',
      guardian: input.kind === 'Longa' ? 'Mariana Ribeiro' : undefined,
      signed: false, messageState: input.kind === 'Longa' ? 'Enviada' : undefined,
      timeline: [{ label: 'Solicitação registrada', at: now() }, ...(input.kind === 'Longa' ? [{ label: 'Envio ao responsável simulado', at: now() }] : [])],
    };
    this.exits.update((items) => [created, ...items]);
    return created;
  }

  updateExit(id: string, input: Pick<ExitRequest, 'kind' | 'departure' | 'expectedReturn' | 'reason' | 'notes'>): ExitRequest {
    this.validateExit(input);
    const existing = this.getExit(id);
    if (!existing || existing.residentId !== this.residentId || !['Aguardando análise', 'Aguardando assinatura', 'Falha no envio'].includes(existing.status)) {
      throw new Error('Esta solicitação não está disponível para edição.');
    }
    const changedLong = existing.kind === 'Longa' || input.kind === 'Longa';
    const updated: ExitRequest = {
      ...existing, ...input, signed: changedLong ? false : existing.signed,
      status: input.kind === 'Longa' ? 'Aguardando assinatura' : 'Aguardando análise',
      guardian: input.kind === 'Longa' ? 'Mariana Ribeiro' : undefined,
      messageState: input.kind === 'Longa' ? 'Enviada' : undefined,
      timeline: [...existing.timeline, { label: 'Solicitação editada', at: now(), detail: changedLong ? 'Documento e assinatura reiniciados para o conteúdo atualizado.' : undefined }],
    };
    this.replaceExit(updated);
    return updated;
  }

  validateExit(input: Pick<ExitRequest, 'kind' | 'departure' | 'expectedReturn' | 'reason'>): void {
    if (!input.reason.trim()) throw new Error('Informe o motivo da saída.');
    const start = Date.parse(input.departure), end = Date.parse(input.expectedReturn);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('O retorno deve ser posterior à saída.');
    if (input.kind === 'Curta' && end - start > 3 * 3_600_000) throw new Error('Saída curta: o retorno deve ocorrer em até três horas.');
  }

  signLongExit(id: string): boolean {
    const item = this.getExit(id);
    if (!item || item.kind !== 'Longa' || item.signed || !['Aguardando assinatura', 'Falha no envio'].includes(item.status)) return false;
    this.replaceExit({ ...item, signed: true, status: 'Aguardando análise', messageState: 'Enviada', timeline: [...item.timeline, { label: 'Assinatura simulada registrada', at: now(), detail: 'Demonstração sem validade jurídica.' }] });
    return true;
  }

  resendLongExit(id: string, note: string): boolean {
    const item = this.getExit(id);
    if (!item || item.kind !== 'Longa' || item.signed || item.status !== 'Falha no envio' || item.messageState !== 'Falha no envio' || !note.trim()) return false;
    this.replaceExit({ ...item, status: 'Aguardando assinatura', messageState: 'Enviada', timeline: [...item.timeline, { label: 'Reenvio simulado', at: now(), detail: note.trim() }] });
    return true;
  }

  decideExit(id: string, decision: 'approve' | 'reject', justification = ''): boolean {
    const item = this.getExit(id);
    if (!item || !['Aguardando análise', 'Aguardando assinatura', 'Falha no envio'].includes(item.status)) return false;
    if (decision === 'approve' && item.kind === 'Longa' && !item.signed) return false;
    if (decision === 'reject' && item.kind === 'Longa' && !item.signed) return false;
    if (decision === 'reject' && !justification.trim()) return false;
    this.replaceExit({ ...item, status: decision === 'approve' ? 'Aprovada' : 'Rejeitada', timeline: [...item.timeline, { label: decision === 'approve' ? 'Aprovada por supervisor' : 'Rejeitada por supervisor', at: now(), detail: justification.trim() || undefined }] });
    return true;
  }

  confirmReturn(id: string, actual: string, observation: string): boolean {
    const item = this.getExit(id);
    const actualMs = Date.parse(actual);
    if (!item || item.kind !== 'Curta' || item.status !== 'Em andamento' || !Number.isFinite(actualMs) || actualMs < Date.parse(item.departure) || actualMs > Date.now()) return false;
    const delayed = actualMs > Date.parse(item.expectedReturn);
    if (delayed && !observation.trim()) return false;
    this.replaceExit({ ...item, status: delayed ? 'Retorno confirmado com atraso' : 'Retorno confirmado', timeline: [...item.timeline, { label: delayed ? 'Retorno confirmado com atraso' : 'Retorno confirmado', at: actual, detail: observation.trim() || 'Presença verificada pelo supervisor.' }] });
    return true;
  }

  viewNotification(id: string): void {
    const item = this.getNotification(id);
    if (item?.status === 'Pendente') this.replaceNotification({ ...item, status: 'Visualizada', timeline: [...item.timeline, { label: 'Visualizada por usuário autorizado', at: now() }] });
  }

  analyzeNotification(id: string): boolean { return this.updateNotificationStatus(id, 'Em análise', 'Análise iniciada'); }
  archiveNotification(id: string, justification: string): boolean {
    return justification.trim() ? this.updateNotificationStatus(id, 'Arquivada', 'Arquivada após análise', justification.trim()) : false;
  }
  convertNotification(id: string, warning: Omit<ManualWarning, 'id' | 'notificationId' | 'resident'>): boolean {
    const item = this.getNotification(id);
    if (!item || ['Arquivada', 'Convertida em advertência'].includes(item.status)) return false;
    if (!warning.description.trim() || !warning.severity.trim() || !warning.justification.trim() || !warning.date || warning.date > new Date().toISOString().slice(0, 10)) return false;
    this.warnings.update((items) => [{ ...warning, id: `A-${items.length + 1}`, notificationId: id, resident: item.resident }, ...items]);
    return this.updateNotificationStatus(id, 'Convertida em advertência', 'Advertência registrada manualmente', warning.justification);
  }

  private updateNotificationStatus(id: string, status: NotificationStatus, label: string, detail?: string): boolean {
    const item = this.getNotification(id);
    if (!item || ['Arquivada', 'Convertida em advertência'].includes(item.status)) return false;
    this.replaceNotification({ ...item, status, decision: detail, timeline: [...item.timeline, { label, at: now(), detail }] });
    return true;
  }
  private replaceExit(value: ExitRequest): void { this.exits.update((items) => items.map((item) => item.id === value.id ? value : item)); }
  private replaceNotification(value: InternalNotification): void { this.notifications.update((items) => items.map((item) => item.id === value.id ? value : item)); }
}
