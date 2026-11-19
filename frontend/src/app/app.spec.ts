import { vi } from 'vitest';
import { signal } from '@angular/core';
import { UnsavedForms } from './shared/unsaved-form';
import { TestBed } from '@angular/core/testing';
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  provideRouter,
  Router,
} from '@angular/router';
import { Subject } from 'rxjs';
import { App } from './app';
import { DemoSessionService } from './core/demo-session.service';
import { LocalAuthService } from './core/local-auth.service';
import {
  PENDING_BY_PATH,
  PendingBadgesService,
  type PendingCounts,
  type PendingKey,
} from './core/pending-badges.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('agrupa o menu em rotina, cadastros e apoio, com separador no início de cada grupo', async () => {
    TestBed.inject(DemoSessionService).deactivate();
    TestBed.inject(LocalAuthService).principal.set({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Supervisora Sintética',
      email: 'supervisor@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['supervisor'],
      residenteId: null,
      supervisorId: null,
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const items = fixture.componentInstance.navItems();
    const paths = items.map((item) => item.path);
    expect(paths.indexOf('/chamada')).toBeLessThan(paths.indexOf('/residentes'));
    expect(paths.indexOf('/relatorios')).toBeLessThan(paths.indexOf('/ajuda'));
    expect(items.filter((item) => item.groupStart).map((item) => item.path)).toEqual([
      '/residentes',
      '/ajuda',
    ]);
    expect(fixture.componentInstance.userName()).toBe('Supervisora Sintética');
  });

  it('identifica a demonstração e a marca no shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('SAGER');
    expect(compiled.textContent).toContain('Dados fictícios');
    expect(compiled.querySelector('img[alt*="Instituto Federal Goiano"]')).toBeTruthy();
  });

  it('oferece análise e avisos somente ao supervisor no acesso local', async () => {
    TestBed.inject(DemoSessionService).deactivate();
    const auth = TestBed.inject(LocalAuthService);
    const account = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Supervisora Sintética',
      email: 'supervisor@example.test',
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['supervisor' as const],
      residenteId: null,
      supervisorId: null,
    };
    auth.principal.set(account);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain(
      '/advertencias',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain(
      '/comunicacoes/avisos',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain('/conversas');
    expect(fixture.componentInstance.navItems().map((item) => item.path)).not.toContain(
      '/supervisores',
    );
    auth.principal.set({ ...account, perfis: ['gestor'] });
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain(
      '/supervisores',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).not.toContain(
      '/conversas',
    );
    expect(fixture.componentInstance.navItems().map((item) => item.path)).toContain('/limpeza');
    expect(fixture.componentInstance.navItems().map((item) => item.path)).not.toContain(
      '/advertencias',
    );
    auth.principal.set({ ...account, perfis: ['residente'] });
    const ownItems = fixture.componentInstance.navItems();
    expect(ownItems.map((item) => item.path)).toContain('/minha-limpeza');
    expect(ownItems.map((item) => item.path)).not.toContain('/limpeza');
    expect(ownItems.find((item) => item.path === '/avisos')?.label).toBe('Minhas comunicações');
    expect(ownItems.map((item) => item.path)).not.toContain('/comunicacoes/avisos');
  });

  it('tira Minhas saídas do menu só do residente maior de idade', async () => {
    const session = TestBed.inject(DemoSessionService);
    session.deactivate();
    const auth = TestBed.inject(LocalAuthService);
    const resident = {
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Residente Sintético',
      email: null,
      matricula: 'TESTE-LOGIN',
      fotoUrl: null,
      perfis: ['residente' as const],
      residenteId: '00000000-0000-0000-0000-000000000002',
      supervisorId: null,
    };
    auth.principal.set({ ...resident, maiorDeIdade: true });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const paths = () => fixture.componentInstance.navItems().map((item) => item.path);
    expect(paths()).not.toContain('/saidas');
    expect(paths()).toContain('/avisos');
    auth.principal.set({ ...resident, maiorDeIdade: false });
    expect(paths()).toContain('/saidas');
    auth.principal.set(null);
    session.activate('residente');
    expect(
      fixture.componentInstance.navItems().find((item) => item.path === '/saidas')?.label,
    ).toBe('Minhas saídas');
    session.deactivate();
  });

  it('confirma alterações antes de encerrar a sessão', async () => {
    TestBed.inject(DemoSessionService).deactivate();
    const logout = vi.spyOn(TestBed.inject(LocalAuthService), 'logout').mockResolvedValue();
    vi.spyOn(TestBed.inject(UnsavedForms), 'canLeave').mockResolvedValue(false);
    const fixture = TestBed.createComponent(App);
    await fixture.componentInstance.signOut();
    expect(logout).not.toHaveBeenCalled();
  });

  it('mostra a barra e marca o conteúdo como ocupado enquanto a tela carrega', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const events = TestBed.inject(Router).events as Subject<RouterEvent>;
    const element = fixture.nativeElement as HTMLElement;
    const state = () => {
      fixture.detectChanges();
      return [
        !!element.querySelector('.navigation-bar[aria-hidden="true"]'),
        element.querySelector('#conteudo-principal')?.getAttribute('aria-busy') ?? null,
      ];
    };
    expect(state()).toEqual([false, null]);
    const ends = [
      new NavigationEnd(1, '/residentes', '/residentes'),
      new NavigationCancel(2, '/residentes', 'guarda'),
      new NavigationError(3, '/residentes', new Error('falhou')),
    ];
    for (const end of ends) {
      events.next(new NavigationStart(end.id, '/residentes'));
      expect(state()).toEqual([true, 'true']);
      events.next(end);
      expect(state()).toEqual([false, null]);
    }
  });
});

describe('App: contadores de pendências', () => {
  const counts = signal<PendingCounts>({});
  const count = (keys: readonly PendingKey[]) =>
    keys.reduce((total, key) => total + (counts()[key] ?? 0), 0);
  const pending = {
    counts,
    count,
    forPath: (path: string) => count(PENDING_BY_PATH[path] ?? []),
    start: vi.fn(),
    refresh: vi.fn(),
  };
  const account = {
    id: '00000000-0000-0000-0000-000000000001',
    nome: 'Conta Sintética',
    email: null,
    matricula: 'TESTE-LOGIN',
    fotoUrl: null,
    residenteId: null,
    supervisorId: null,
  };

  beforeEach(async () => {
    counts.set({});
    pending.start.mockClear();
    pending.refresh.mockClear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: PendingBadgesService, useValue: pending }],
    }).compileComponents();
    TestBed.inject(DemoSessionService).deactivate();
  });

  async function shell(profile: 'gestor' | 'supervisor' | 'residente') {
    TestBed.inject(LocalAuthService).principal.set({
      ...account,
      perfis: [profile],
      residenteId: profile === 'residente' ? '00000000-0000-0000-0000-000000000002' : null,
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const link = (path: string) =>
      element.querySelector<HTMLAnchorElement>(`#app-navigation nav a[href="${path}"]`);
    return { fixture, element, link };
  }

  it('mostra o número e lê "N pendentes" nos itens do supervisor', async () => {
    counts.set({ shortExits: 2, longExits: 1, notifications: 3, nightCalls: 1, conversations: 0 });
    const { link } = await shell('supervisor');
    expect(link('/saidas')?.querySelector('.pending-badge')?.textContent?.trim()).toBe('3');
    expect(link('/saidas')?.querySelector('.pending-badge')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(link('/saidas')?.querySelector('.sr-only')?.textContent).toBe(', 3 pendentes');
    expect(link('/notificacoes')?.querySelector('.sr-only')?.textContent).toBe(', 3 pendentes');
    expect(link('/chamada')?.querySelector('.sr-only')?.textContent).toBe(', 1 pendente');
    // Zero não desenha nada; itens sem regra de contagem também não.
    expect(link('/conversas')).not.toBeNull();
    expect(link('/conversas')?.querySelector('.pending-badge')).toBeNull();
    expect(link('/limpeza')?.querySelector('.pending-badge')).toBeNull();
    expect(link('/advertencias')?.querySelector('.pending-badge')).toBeNull();
  });

  it('soma os contadores no botão "Menu", que mantém o nome e lê a soma como descrição', async () => {
    counts.set({ shortExits: 2, longExits: 1, notifications: 3, nightCalls: 1, conversations: 0 });
    const { fixture, element } = await shell('supervisor');
    const button = element.querySelector<HTMLButtonElement>('.menu-toggle')!;
    expect(button.querySelector('.pending-badge')?.textContent?.trim()).toBe('7');
    expect(button.querySelector('.sr-only')).toBeNull();
    expect(button.getAttribute('aria-describedby')).toBe('menu-pending');
    const description = element.querySelector<HTMLElement>('#menu-pending')!;
    expect(description.hidden).toBe(true);
    expect(description.textContent?.trim()).toBe('7 pendentes no menu');

    counts.set({ shortExits: 0, longExits: 0, notifications: 0, nightCalls: 0, conversations: 0 });
    fixture.detectChanges();
    expect(button.querySelector('.pending-badge')).toBeNull();
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(element.querySelector('#menu-pending')).toBeNull();
  });

  it('mostra as comunicações sem ciência do residente em "Minhas comunicações"', async () => {
    counts.set({ notices: 1, warnings: 3, terms: 0 });
    const { link } = await shell('residente');
    expect(link('/avisos')?.textContent).toContain('Minhas comunicações');
    expect(link('/avisos')?.querySelector('.pending-badge')?.textContent?.trim()).toBe('4');
    expect(link('/avisos')?.querySelector('.sr-only')?.textContent).toBe(', 4 pendentes');
    expect(link('/saidas')?.querySelector('.pending-badge')).toBeNull();
  });

  it('não mostra contador ao gestor', async () => {
    counts.set({ shortExits: 2 });
    const { element } = await shell('gestor');
    expect(element.querySelector('.pending-badge')).toBeNull();
    expect(element.querySelector('.menu-toggle')?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('liga a contagem ao abrir e a refaz a cada troca de tela', async () => {
    await shell('supervisor');
    expect(pending.start).toHaveBeenCalledTimes(1);
    const events = TestBed.inject(Router).events as Subject<RouterEvent>;
    events.next(new NavigationEnd(1, '/saidas', '/saidas'));
    events.next(new NavigationEnd(2, '/inicio', '/inicio'));
    expect(pending.refresh).toHaveBeenCalledTimes(2);
  });
});
