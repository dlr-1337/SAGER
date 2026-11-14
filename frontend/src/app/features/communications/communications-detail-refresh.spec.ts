import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { from } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { ResidentApiService } from '../management/resident-api.service';
import { CommunicationsLocalApiService } from './communications-local-api.service';
import {
  DisciplineNotification,
  DisciplineTerm,
  DisciplineWarning,
  OwnCommunication,
} from './communications-local.models';
import { formatCommunicationTime } from './communications-local.utils';
import { NoticeDetailLocalPage } from './notices-local.pages';
import { NotificationDetailLocalPage, NotificationsLocalPage } from './notifications-local.pages';
import { OwnCommunicationDetailLocalPage } from './own-communications-local.pages';
import { RecurrenceLocalPage, TermDetailLocalPage } from './recurrence-local.pages';
import { WarningDetailLocalPage } from './warnings-local.pages';

const warning: DisciplineWarning = {
  id: 'adv-1',
  residentId: 'res-1',
  residentName: 'Residente Sintético',
  occurrenceId: null,
  notificationId: null,
  status: 'VIGENTE',
  requiresReview: false,
  issuedAt: '2026-11-10T12:00:00Z',
  issuedBy: 'supervisor-sintetico',
  communicationId: 'com-1',
  version: 0,
  annulmentReason: null,
  category: 'AUSENCIA',
  severity: 'LEVE',
  description: 'Ausência sintética',
  justification: 'Justificativa sintética.',
  warningDate: '2026-11-10',
};
const own: OwnCommunication = {
  id: 'com-1',
  kind: 'AVISO',
  sourceId: 'aviso-1',
  contentVersion: 1,
  title: 'Aviso sintético',
  body: 'Mensagem sintética.',
  publishedAt: '2026-11-10T12:00:00Z',
  status: 'PUBLICADO',
  stateReason: null,
  requiresReview: false,
  readAt: null,
  acknowledgedAt: null,
  document: null,
};
const term: DisciplineTerm = {
  id: 'termo-1',
  residentId: 'res-1',
  residentName: 'Residente Sintético',
  warningIds: ['adv-1', 'adv-2'],
  decision: 'Decisão sintética.',
  status: 'EMITIDO',
  issuedAt: '2026-11-10T12:00:00Z',
  issuedBy: 'supervisor-sintetico',
  communicationId: 'com-2',
  document: { id: 'doc-1', sha256: 'a'.repeat(64), size: 1200, state: 'STORED' },
  version: 0,
  annulmentReason: null,
};
const notification = {
  id: 'not-1',
  occurrenceId: 'oc-1',
  residentId: 'res-1',
  residentName: 'Residente Sintético',
  category: 'AUSENCIA',
  status: 'PENDENTE',
  requiresReview: false,
  version: 0,
  occurrenceVersion: 0,
  valid: true,
  events: [],
} as unknown as DisciplineNotification;
const notice = {
  id: 'aviso-1',
  title: 'Aviso sintético',
  body: 'Mensagem sintética.',
  residentIds: ['res-1'],
  status: 'PUBLICADO',
  version: 0,
  publishedAt: '2026-11-10T12:00:00Z',
  communicationId: 'com-1',
  withdrawalReason: null,
};

describe('Detalhes de comunicação se atualizam sozinhos', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    api = {
      warning: vi.fn(),
      own: vi.fn(),
      term: vi.fn(),
      notification: vi.fn(),
      notifications: vi.fn(),
      occurrence: vi.fn().mockResolvedValue({
        id: 'oc-1',
        version: 0,
        valid: true,
        category: 'AUSENCIA',
        occurredAt: '2026-11-10T12:00:00Z',
        evidence: {},
        revisions: [],
      }),
      context: vi.fn().mockResolvedValue({ now: '', currentDate: '2026-11-14' }),
      convert: vi.fn().mockResolvedValue({ ...warning, id: 'adv-9' }),
      notice: vi.fn().mockResolvedValue(notice),
      recurrences: vi.fn().mockResolvedValue([]),
      terms: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'item-1' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: CommunicationsLocalApiService, useValue: api },
        {
          provide: ResidentApiService,
          useValue: {
            list: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue({ id: 'res-1', name: 'Residente Sintético' }),
          },
        },
        {
          provide: MatDialog,
          // Confirma depois do clique, como o diálogo de verdade.
          useValue: {
            open: () => ({ afterClosed: () => from(Promise.resolve({})) }),
            openDialogs: [],
          },
        },
        { provide: DemoSessionService, useValue: { active: signal(false), hasRole: () => true } },
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (document as { hidden?: boolean }).hidden;
  });

  it.each([
    {
      name: 'advertência',
      component: WarningDetailLocalPage as Type<unknown>,
      method: 'warning',
      before: warning,
      after: { ...warning, status: 'ANULADA', version: 1, annulmentReason: 'Motivo sintético.' },
      texts: ['Valendo', 'Anulada'],
    },
    {
      name: 'comunicação do residente',
      component: OwnCommunicationDetailLocalPage as Type<unknown>,
      method: 'own',
      before: own,
      after: { ...own, status: 'RETIRADO', stateReason: 'Motivo sintético.' },
      texts: ['Valendo', 'Retirado'],
    },
    {
      name: 'termo',
      component: TermDetailLocalPage as Type<unknown>,
      method: 'term',
      before: term,
      after: { ...term, status: 'ANULADO', version: 1, annulmentReason: 'Motivo sintético.' },
      texts: ['Termo valendo', 'Termo anulado'],
    },
  ])('$name troca a situação aos 15 s, sem botão de atualizar', async (item) => {
    api[item.method].mockResolvedValueOnce(item.before).mockResolvedValueOnce(item.after);
    const fixture = TestBed.createComponent(item.component);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const buttons = () => [...element.querySelectorAll('button')].map((b) => b.textContent!.trim());
    expect(element.textContent).toContain(item.texts[0]);
    expect(buttons()).not.toContain('Atualizar dados');
    expect(buttons()).not.toContain('Recarregar dados');
    await vi.advanceTimersByTimeAsync(15_000);
    fixture.detectChanges();
    expect(api[item.method]).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain(item.texts[1]);
    expect(element.querySelector('[role=alert]')).toBeNull();
    fixture.destroy();
  });

  it.each(['desistir', 'salvar'])(
    'notificação com a advertência sendo escrita só se atualiza depois de %s',
    async (end) => {
      api['notification'].mockResolvedValue(notification);
      const fixture = TestBed.createComponent(NotificationDetailLocalPage);
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const element: HTMLElement = fixture.nativeElement;
      const buttons = () => [...element.querySelectorAll('button')];
      const button = (name: string) => buttons().find((b) => b.textContent!.trim() === name)!;
      expect(buttons().map((b) => b.textContent!.trim())).not.toContain('Atualizar dados');
      button('Criar advertência').click();
      fixture.detectChanges();
      const type = (name: string, value: string) => {
        const field = element.querySelector<HTMLTextAreaElement>(`[formcontrolname=${name}]`)!;
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        return field;
      };
      const description = type('description', 'Texto que o supervisor digitou');
      await vi.advanceTimersByTimeAsync(30_000);
      fixture.detectChanges();
      expect(api['notification']).toHaveBeenCalledTimes(1);
      expect(description.value).toBe('Texto que o supervisor digitou');
      if (end === 'desistir') button('Fechar advertência').click();
      else {
        type('justification', 'Justificativa sintética da decisão.');
        button('Conferir advertência').click();
        await vi.advanceTimersByTimeAsync(0);
        expect(api['convert']).toHaveBeenCalledOnce();
      }
      fixture.detectChanges();
      const calls = api['notification'].mock.calls.length;
      await vi.advanceTimersByTimeAsync(15_000);
      expect(api['notification']).toHaveBeenCalledTimes(calls + 1);
      fixture.destroy();
    },
  );

  it('a ciência do residente aparece aos 15 s no detalhe do aviso', async () => {
    const acknowledgedAt = '2026-11-14T13:00:00Z';
    api['own']
      .mockResolvedValueOnce({ ...own, readAt: '2026-11-14T12:00:00Z' })
      .mockResolvedValueOnce({ ...own, readAt: '2026-11-14T12:00:00Z', acknowledgedAt });
    const fixture = TestBed.createComponent(OwnCommunicationDetailLocalPage);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Ainda não marcado');
    await vi.advanceTimersByTimeAsync(15_000);
    fixture.detectChanges();
    expect(element.textContent).not.toContain('Ainda não marcado');
    expect(element.textContent).toContain(formatCommunicationTime(acknowledgedAt));
    const buttons = [...element.querySelectorAll('button')].map((b) => b.textContent!.trim());
    expect(buttons).not.toContain('Estou ciente');
    fixture.destroy();
  });

  it.each([
    { name: 'aviso', component: NoticeDetailLocalPage as Type<unknown>, heading: 'Aviso' },
    {
      name: 'reincidência',
      component: RecurrenceLocalPage as Type<unknown>,
      heading: 'Revisar possível reincidência',
    },
  ])('detalhe de $name não tem "Atualizar dados"', async (item) => {
    const fixture = TestBed.createComponent(item.component);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h1')?.textContent?.trim()).toBe(item.heading);
    expect(element.querySelector('sager-auto-refresh-status')).not.toBeNull();
    const buttons = [...element.querySelectorAll('button')].map((b) => b.textContent!.trim());
    expect(buttons).not.toContain('Atualizar dados');
    fixture.destroy();
  });

  it('falha na atualização automática não apaga a tela já carregada', async () => {
    api['warning'].mockResolvedValueOnce(warning).mockRejectedValueOnce(new Error('falha'));
    const view = TestBed.runInInjectionContext(() => new WarningDetailLocalPage());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(view.item()).toEqual(warning);
    expect(view.loadError()).toBe('');
    expect(view.refresh.failed()).toBe(true);
  });

  it('lista consulta de novo aos 15 s a mesma página, com o mesmo filtro', async () => {
    const page = (id: string, nextCursor: number | null) => ({ items: [{ id }], nextCursor });
    api['notifications']
      .mockResolvedValueOnce(page('primeira', 10))
      .mockResolvedValueOnce(page('segunda', null))
      .mockResolvedValueOnce(page('nova', null));
    const view = TestBed.runInInjectionContext(() => new NotificationsLocalPage());
    await view.filter({ status: 'PENDENTE' });
    await view.list.go(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(api['notifications']).toHaveBeenCalledTimes(3);
    expect(api['notifications'].mock.calls[2]).toEqual([
      '',
      'PENDENTE',
      10,
      { status: 'PENDENTE' },
    ]);
    expect(view.list.page()).toBe(1);
    expect(view.list.items()).toEqual([{ id: 'nova' }]);
  });
});
