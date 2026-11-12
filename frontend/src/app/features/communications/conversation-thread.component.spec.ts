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
  ...values,
});

/** jsdom has no layout: the list gets a fixed 200 px window over a content height the test sets. */
async function setup() {
  const state = { items: [message('1'), message('2')], height: 1000, top: 0 };
  const api = {
    get: vi.fn(async () => conversation),
    messages: vi.fn(async () => ({ items: state.items, nextCursor: null })),
    markRead: vi.fn(async () => undefined),
    mediaUrl: (id: string) => `/midia/${id}`,
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

  it('preserva a posição de quem subiu para ler quando chega mensagem nova', async () => {
    const { state, thread, scrollTo, settle } = await setup();
    await scrollTo(100);
    state.items = [...state.items, message('3')];
    await thread.refresh();
    state.height = 1200;
    await settle();
    expect(state.top).toBe(100);
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
