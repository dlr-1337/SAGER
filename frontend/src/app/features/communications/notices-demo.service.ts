import { Injectable, computed, inject, signal } from '@angular/core';
import { OperationsDemoService } from '../operations/operations-demo.service';

export type NoticeKind = 'aviso' | 'advertencia';
export interface ResidentNotice {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  date: string;
  source: string;
  readAt?: string;
  acknowledgedAt?: string;
}

const INITIAL_NOTICES: ResidentNotice[] = [
  { id: 'av-1', kind: 'aviso', title: 'Orientação sobre a chamada noturna', body: 'A chamada da residência está prevista para 22h30. Se precisar de apoio ou identificar alguma divergência, procure o supervisor de plantão.', date: '2026-09-22T14:00:00', source: 'Assistência Estudantil' },
  { id: 'av-2', kind: 'aviso', title: 'Atendimento da Assistência Estudantil', body: 'A equipe da Assistência Estudantil está disponível para orientar os residentes sobre os processos da moradia.', date: '2026-09-19T09:00:00', source: 'Assistência Estudantil', acknowledgedAt: '2026-09-20T10:42:00', readAt: '2026-09-20T10:40:00' },
  { id: 'ad-1', kind: 'advertencia', title: 'Advertência registrada após análise', body: 'Registro demonstrativo para apresentar a consulta e a ciência de uma advertência. A decisão foi feita manualmente após análise do supervisor; esta informação não corresponde a qualquer pessoa real.', date: '2026-09-18T16:00:00', source: 'Supervisão da residência' },
];

@Injectable({ providedIn: 'root' })
export class NoticesDemoService {
  private readonly operations = inject(OperationsDemoService);
  private readonly seeded = signal<ResidentNotice[]>(INITIAL_NOTICES.map(item => ({ ...item })));
  private readonly dynamicState = signal<Record<string, Pick<ResidentNotice, 'readAt' | 'acknowledgedAt'>>>({});
  readonly notices = computed<ResidentNotice[]>(() => {
    const currentResident = this.operations.minors.find(item => item.id === this.operations.residentId)?.name;
    const fromManualReview: ResidentNotice[] = this.operations.warnings()
      .filter(warning => warning.resident === currentResident)
      .map(warning => {
        const id = `warning-${warning.id}`;
        return {
          id, kind: 'advertencia', title: 'Advertência registrada após análise',
          body: `${warning.description}\n\nJustificativa: ${warning.justification}`,
          date: warning.date, source: 'Supervisão da residência',
          ...this.dynamicState()[id],
        };
      });
    return [...this.seeded(), ...fromManualReview];
  });
  readonly pendingCount = computed(() => this.notices().filter(item => !item.acknowledgedAt).length);

  open(id: string): void {
    if (this.seeded().some(item => item.id === id)) this.seeded.update(items => items.map(item => item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item));
    else this.updateDynamic(id, 'readAt');
  }

  acknowledge(id: string): void {
    if (this.seeded().some(item => item.id === id)) this.seeded.update(items => items.map(item => item.id === id && !item.acknowledgedAt ? { ...item, acknowledgedAt: new Date().toISOString() } : item));
    else this.updateDynamic(id, 'acknowledgedAt');
  }

  private updateDynamic(id: string, key: 'readAt' | 'acknowledgedAt'): void {
    if (!this.notices().some(item => item.id === id) || this.dynamicState()[id]?.[key]) return;
    this.dynamicState.update(state => ({ ...state, [id]: { ...state[id], [key]: new Date().toISOString() } }));
  }
}
