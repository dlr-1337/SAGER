import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoSessionService } from '../../core/demo-session.service';
import { GuardianApiService } from '../management/guardian-api.service';
import { ConversationsApiService } from './conversations-api.service';
import { ConversationThreadComponent, ConversationsPage } from './conversations-local.pages';
import { Conversation, SessionView } from './conversations.models';

const KEY = 'sager.conversas.lista-recolhida';
const conversation: Conversation = {
  id: 'c1',
  chatId: '5562999990001@c.us',
  phone: '+5562999990001',
  linked: true,
  guardians: [
    {
      id: 'g1',
      name: 'Maria Sintética',
      relationship: 'Mãe',
      phone: '+5562999990001',
      residentId: 'r1',
      residentName: 'Ana Sintética',
    },
  ],
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: null,
};
const session: SessionView = {
  available: true,
  status: 'WORKING',
  linkedAt: null,
  lastEventAt: null,
  canSend: true,
  unavailableReason: null,
};

async function setup(path: string) {
  const api = {
    list: vi.fn(async () => ({ items: [conversation], nextCursor: null })),
    session: vi.fn(async () => session),
    get: vi.fn(async () => conversation),
    messages: vi.fn(async () => ({ items: [], nextCursor: null })),
    markRead: vi.fn(async () => undefined),
    mediaUrl: (id: string) => `/midia/${id}`,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'conversas',
          component: ConversationsPage,
          children: [{ path: ':id', component: ConversationThreadComponent }],
        },
      ]),
      { provide: ConversationsApiService, useValue: api },
      { provide: GuardianApiService, useValue: { page: vi.fn() } },
      { provide: DemoSessionService, useValue: { active: signal(false) } },
      { provide: MatDialog, useValue: { openDialogs: [] } },
    ],
  });
  const harness = await RouterTestingHarness.create(path);
  await harness.fixture.whenStable();
  const root = harness.fixture.nativeElement as HTMLElement;
  return {
    harness,
    settle: () => harness.fixture.whenStable(),
    toggle: () => root.querySelector<HTMLButtonElement>('.conv-collapse'),
    shell: () => root.querySelector('.conv-shell')!,
    list: () => root.querySelector('#conv-list'),
  };
}

describe('Lista de conversas recolhível', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('recolhe e mostra a lista pelo botão da conversa, com aria-expanded', async () => {
    const { settle, toggle, shell, list } = await setup('/conversas/c1');
    expect(list()).not.toBeNull();
    expect(toggle()!.getAttribute('aria-controls')).toBe('conv-list');
    expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
    expect(toggle()!.textContent).toContain('Recolher conversas');

    toggle()!.click();
    await settle();
    expect(shell().classList).toContain('conv-list-collapsed');
    expect(toggle()!.getAttribute('aria-expanded')).toBe('false');
    expect(toggle()!.textContent).toContain('Mostrar conversas');
    expect(localStorage.getItem(KEY)).toBe('1');

    toggle()!.click();
    await settle();
    expect(shell().classList).not.toContain('conv-list-collapsed');
    expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('lembra a escolha neste navegador e devolve a lista sem conversa aberta', async () => {
    localStorage.setItem(KEY, '1');
    const { harness, settle, toggle, shell } = await setup('/conversas/c1');
    expect(shell().classList).toContain('conv-list-collapsed');
    expect(toggle()!.getAttribute('aria-expanded')).toBe('false');

    await harness.navigateByUrl('/conversas');
    await settle();
    expect(shell().classList).not.toContain('conv-list-collapsed');
    expect(toggle()).toBeNull();
    // A escolha continua para a próxima conversa aberta.
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('sem armazenamento no navegador, recolher vale só nesta visita', async () => {
    const blocked = () => {
      throw new DOMException('Bloqueado', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    const { settle, toggle, shell } = await setup('/conversas/c1');
    expect(shell().classList).not.toContain('conv-list-collapsed');

    toggle()!.click();
    await settle();
    expect(shell().classList).toContain('conv-list-collapsed');
  });
});
