import { Injector, type Signal, type WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import type { PendingCounts } from '../../core/pending-badges.service';
import { NoticesDemoService } from '../communications/notices-demo.service';
import { OperationsDemoService } from '../operations/operations-demo.service';
import { demoPendingCounts } from './pending-badges-demo';

const HOUR = 3_600_000;

describe('Contadores da demonstração', () => {
  let session: DemoSessionService;
  let operations: OperationsDemoService;
  let now: WritableSignal<number>;
  let counts: Signal<PendingCounts>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    session = TestBed.inject(DemoSessionService);
    session.activate('supervisor');
    operations = TestBed.inject(OperationsDemoService);
    now = signal(Date.now());
    counts = demoPendingCounts(TestBed.inject(Injector), now);
  });
  afterEach(() => session.deactivate());

  it('mostra ao supervisor as saídas, as notificações não vistas e a chamada à espera', () => {
    // N-201 está pendente; N-200, já em análise, fica na lista e fora do contador.
    expect(counts()).toEqual({
      shortExits: 1,
      longExits: 2,
      notifications: 1,
      nightCalls: 1,
      conversations: 0,
    });
  });

  it('acompanha as decisões e a chamada concluída na demonstração', () => {
    expect(operations.decideExit('S-1045', 'reject', 'Recusa sintética para o teste.')).toBe(true);
    expect(counts().shortExits).toBe(0);
    // A notificação vista sai do contador e continua na lista como "Visualizada".
    expect(counts().notifications).toBe(1);
    operations.viewNotification('N-201');
    expect(operations.getNotification('N-201')?.status).toBe('Visualizada');
    expect(counts().notifications).toBe(0);
    expect(operations.archiveNotification('N-201', 'Arquivada no teste.')).toBe(true);
    expect(counts().notifications).toBe(0);
    operations.callCompleted.set(true);
    expect(counts().nightCalls).toBe(0);
  });

  it('conta a saída aprovada só entre a hora de sair e o retorno previsto', () => {
    expect(operations.decideExit('S-1045', 'approve')).toBe(true);
    expect(operations.getExit('S-1045')?.status).toBe('Aprovada');
    expect(counts().shortExits).toBe(0);
    now.set(Date.now() + 6 * HOUR + 60_000);
    expect(counts().shortExits).toBe(1);
    now.set(Date.now() + 9 * HOUR + 60_000);
    expect(counts().shortExits).toBe(0);
  });

  it('mostra ao residente o aviso e a advertência sem ciência', () => {
    session.setRole('residente');
    expect(counts()).toEqual({ notices: 1, warnings: 1, terms: 0 });
    // Abrir não é dar ciência.
    TestBed.inject(NoticesDemoService).open('av-1');
    expect(counts().notices).toBe(1);
    TestBed.inject(NoticesDemoService).acknowledge('av-1');
    expect(counts()).toEqual({ notices: 0, warnings: 1, terms: 0 });
  });

  it('não mostra números ao gestor nem fora do cenário Padrão', () => {
    for (const scenario of ['vazio', 'erro', 'carregando'] as const) {
      session.setScenario(scenario);
      expect(counts()).toEqual({});
    }
    session.setScenario('padrao');
    session.setRole('gestor');
    expect(counts()).toEqual({});
  });
});
