import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationsApiService } from './conversations-api.service';
import { ConversationThreadComponent, ConversationsPage } from './conversations-local.pages';
import { Conversation, ConversationMessage } from './conversations.models';

const conversation: Conversation = {
  id: 'c1',
  chatId: '5562999990001@c.us',
  phone: '+5562999990001',
  linked: false,
  guardians: [],
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: null,
};
const message = (id: string, values: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id,
  conversationId: 'c1',
  direction: 'IN',
  origin: 'WEBHOOK',
  kind: 'TEXT',
  body: `Mensagem sintética ${id}`,
  mediaState: 'NONE',
  mediaFailureCode: null,
  mediaType: null,
  mediaFilename: null,
  mediaSize: 0,
  deliveryStatus: null,
  failureCode: null,
  sentAt: `2026-11-11T12:0${id}:00Z`,
  linkable: false,
  linkedExit: null,
  ...values,
});

const exit = {
  id: 'saida-1',
  version: 1,
  residentId: 'r1',
  residentName: 'Residente Sintético',
  guardianId: 'g1',
  guardianName: 'Responsável Sintético',
  requestedDepartureAt: '2026-11-15T12:00:00Z',
  expectedReturnAt: '2026-11-17T12:00:00Z',
};
const pdf = (id: string, values: Partial<ConversationMessage> = {}) =>
  message(id, {
    kind: 'DOCUMENT',
    body: null,
    mediaState: 'STORED',
    mediaType: 'application/pdf',
    mediaFilename: `autorizacao-${id}.pdf`,
    mediaSize: 2048,
    ...values,
  });

/** jsdom has no layout: the list gets a fixed 200 px window over a content height the test sets. */
async function setup(items = [message('1'), message('2')]) {
  const state = { items, height: 1000, top: 0 };
  const api = {
    get: vi.fn(async () => conversation),
    messages: vi.fn(async () => ({ items: state.items, nextCursor: null })),
    markRead: vi.fn(async () => undefined),
    mediaUrl: (id: string) => `/midia/${id}`,
    openExits: vi.fn(async () => [exit]),
    link: vi.fn(async () => ({ id: exit.id })),
    sendText: vi.fn(async (_id: string, text: string) =>
      message('3', {
        direction: 'OUT',
        origin: 'SUPERVISOR',
        body: text,
        deliveryStatus: 'QUEUED',
      }),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'conversas/:id', component: ConversationThreadComponent }]),
      { provide: ConversationsApiService, useValue: api },
      {
        provide: ConversationsPage,
        useValue: {
          thread: null,
          connection: signal(null),
          refreshList: vi.fn(async () => undefined),
          markedRead: vi.fn(),
        },
      },
    ],
  });
  const harness = await RouterTestingHarness.create('/conversas/c1');
  await harness.fixture.whenStable();
  const thread = harness.routeDebugElement!.componentInstance as ConversationThreadComponent;
  const log: HTMLElement = harness.routeNativeElement!.querySelector('.conv-log')!;
  Object.defineProperty(log, 'scrollHeight', { get: () => state.height });
  Object.defineProperty(log, 'clientHeight', { get: () => 200 });
  Object.defineProperty(log, 'scrollTop', {
    get: () => state.top,
    set: (value: number) => (state.top = Math.max(0, Math.min(value, state.height - 200))),
  });
  const scrollTo = async (top: number) => {
    log.scrollTop = top;
    log.dispatchEvent(new Event('scroll'));
  };
  const settle = () => harness.fixture.whenStable();
  return { api, state, thread, harness, log, scrollTo, settle };
}

describe('Rolagem da conversa', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mantém no fim quem estava no fim, mesmo quando só a situação de entrega muda', async () => {
    const { state, thread, scrollTo, settle } = await setup();
    await scrollTo(800);
    state.items = [message('1'), message('2', { deliveryStatus: 'FAILED' })];
    await thread.refresh();
    // The note under the failed message only takes space once rendered.
    state.height = 1100;
    await settle();
    expect(state.top).toBe(900);
  });

  it('não puxa para o fim, numa atualização sem mudança, quem subiu um pouco para ler', async () => {
    const { state, thread, scrollTo, settle } = await setup();
    await scrollTo(740);
    await thread.refresh();
    await settle();
    expect(state.top).toBe(740);
  });

  it('preserva a posição de quem subiu para ler quando chega mensagem nova', async () => {
    const { state, thread, scrollTo, settle } = await setup();
    await scrollTo(100);
    state.items = [...state.items, message('3')];
    await thread.refresh();
    state.height = 1200;
    await settle();
    expect(state.top).toBe(100);
  });

  it('rascunho apagado deixa de segurar a atualização automática', async () => {
    const { harness, thread } = await setup();
    const draft = harness.routeNativeElement!.querySelector('textarea')!;
    const type = async (value: string) => {
      draft.value = value;
      draft.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve));
    };
    await type('Oi');
    expect(thread.form.dirty).toBe(true);
    await type('');
    expect(thread.form.dirty).toBe(false);
  });

  it('ao enviar, desce ao fim e devolve o foco ao campo sem rolar a página', async () => {
    const { harness, state, thread, scrollTo, settle } = await setup();
    await scrollTo(100);
    const focus = vi.spyOn(HTMLTextAreaElement.prototype, 'focus');
    const send: HTMLButtonElement = harness.routeNativeElement!.querySelector('.conv-send')!;
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    send.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    thread.form.controls.text.setValue('Confirmado.');
    state.height = 1100;
    await thread.send();
    await settle();
    expect(state.top).toBe(900);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});

describe('Situação do arquivo recebido', () => {
  afterEach(() => vi.restoreAllMocks());
  const bubble = (root: HTMLElement, file: string) =>
    [...root.querySelectorAll<HTMLElement>('.conv-msg')].find((item) =>
      item.textContent!.includes(file),
    )!;

  it('mostra livre, ligado (aguardando e conferido) e falha, sem identificadores', async () => {
    const { harness } = await setup([
      pdf('1', { linkable: true }),
      pdf('2', {
        linkedExit: { id: exit.id, residentName: 'Ana Sintética', fileState: 'CANDIDATE' },
      }),
      pdf('3', {
        linkedExit: { id: exit.id, residentName: 'Ana Sintética', fileState: 'ACCEPTED' },
      }),
      pdf('4', { mediaState: 'FAILED', mediaFailureCode: 'download_failed' }),
    ]);
    const root = harness.routeNativeElement!;
    expect(bubble(root, 'autorizacao-1.pdf').textContent).toContain('Vincular a uma saída longa');
    for (const [file, state] of [
      ['autorizacao-2.pdf', 'aguardando conferência'],
      ['autorizacao-3.pdf', 'conferido'],
    ]) {
      const item = bubble(root, file);
      expect(item.textContent).toContain('Na saída longa de Ana Sintética');
      expect(item.querySelector('.conv-linked')!.textContent).toContain(state);
      expect(item.textContent).not.toContain('Vincular a uma saída longa');
      expect(item.textContent).not.toContain(exit.id);
      const link = item.querySelector<HTMLAnchorElement>('.conv-linked a')!;
      expect(link.textContent!.trim()).toBe('Abrir saída');
      expect(link.getAttribute('href')).toBe(`/saidas/longas/${exit.id}`);
    }
    const failed = [...root.querySelectorAll<HTMLElement>('.conv-msg')][3];
    expect(failed.textContent).toContain('Arquivo indisponível');
    expect(failed.querySelector('.conv-linked, .conv-inline')).toBeNull();
  });

  it('depois de vincular, o aviso fica sem link e o foco vai ao Abrir saída do balão', async () => {
    const { api, state, thread, harness, settle } = await setup([pdf('1', { linkable: true })]);
    thread.openLink(state.items[0]);
    await settle();
    state.items = [
      pdf('1', {
        linkedExit: { id: exit.id, residentName: exit.residentName, fileState: 'CANDIDATE' },
      }),
    ];
    await thread.link(thread.linking()!);
    await settle();
    const root = harness.routeNativeElement!;
    expect(api.link).toHaveBeenCalledWith('1', exit);
    const notice = root.querySelector<HTMLElement>('.conv-banner[data-tone=success]')!;
    expect(notice.textContent).toContain('Arquivo vinculado à saída de Residente Sintético');
    expect(notice.querySelector('a')).toBeNull();
    expect(root.querySelector('.conv-linked')!.textContent).toContain('aguardando conferência');
    expect(document.activeElement?.id).toBe('conv-exit-1');
  });
});
